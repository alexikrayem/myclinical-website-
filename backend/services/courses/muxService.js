import jwt from 'jsonwebtoken';
import { AppError, BadRequestError } from '../../utils/errors.js';

const MUX_STREAM_BASE_URL = 'https://stream.mux.com';
const MUX_IMAGE_BASE_URL = 'https://image.mux.com';

function decodePrivateKey(value) {
  if (!value) return null;

  const normalized = value.replace(/\\n/g, '\n');
  if (normalized.includes('BEGIN')) return normalized;

  try {
    return Buffer.from(normalized, 'base64').toString('utf8');
  } catch {
    return normalized;
  }
}

export function parseMuxPlaybackSource(source) {
  const raw = String(source || '').trim();
  if (!raw) {
    throw new BadRequestError('Missing Mux playback ID');
  }

  let playbackId = raw;
  let policy = null;

  if (raw.startsWith('mux://')) {
    const value = raw.slice('mux://'.length).replace(/^\/+/, '');
    const [first, ...rest] = value.split('/');
    if ((first === 'signed' || first === 'public') && rest.length > 0) {
      policy = first;
      playbackId = rest.join('/');
    } else {
      playbackId = value;
    }
  } else {
    try {
      const parsed = new URL(raw);
      if (parsed.hostname === 'stream.mux.com') {
        playbackId = parsed.pathname.replace(/^\/+/, '').replace(/\.m3u8$/, '');
      }
    } catch {
      // Plain playback IDs are expected.
    }
  }

  playbackId = playbackId.trim().replace(/\.m3u8$/, '');
  if (!/^[A-Za-z0-9_-]{6,256}$/.test(playbackId)) {
    throw new BadRequestError('Invalid Mux playback ID');
  }

  return { playbackId, policy };
}

/**
 * Signs a single Mux JWT for a given audience type.
 * @param {string} playbackId
 * @param {'v'|'t'|'s'} aud - 'v' = playback, 't' = thumbnail, 's' = storyboard
 * @param {number} exp - expiry unix timestamp
 * @param {string} keyId
 * @param {string} privateKey
 * @param {object} [extra] - additional claims (e.g. custom)
 */
function signMuxJwt(playbackId, aud, exp, keyId, privateKey, extra = {}) {
  const claims = {
    sub: playbackId,
    aud,
    exp,
    kid: keyId,
    ...extra,
  };

  const restrictionId = process.env.MUX_PLAYBACK_RESTRICTION_ID;
  if (restrictionId && aud === 'v') {
    claims.playback_restriction_id = restrictionId;
  }

  return jwt.sign(claims, privateKey, {
    algorithm: 'RS256',
    noTimestamp: true,
  });
}

export function createMuxPlaybackDescriptor({ playbackSource, sessionId, expiresAt }) {
  const { playbackId, policy } = parseMuxPlaybackSource(playbackSource);
  const defaultPolicy = process.env.MUX_DEFAULT_PLAYBACK_POLICY;
  const effectivePolicy = policy || (defaultPolicy === 'signed' || defaultPolicy === 'public' ? defaultPolicy : null);
  const keyId = process.env.MUX_SIGNING_KEY_ID;
  const privateKey = decodePrivateKey(process.env.MUX_SIGNING_PRIVATE_KEY || process.env.MUX_SIGNING_KEY_PRIVATE_KEY);
  const requireSigned = process.env.MUX_REQUIRE_SIGNED_PLAYBACK === 'true' || effectivePolicy === 'signed';
  const shouldSign = effectivePolicy !== 'public' && Boolean(keyId && privateKey);

  const manifestUrl = `${MUX_STREAM_BASE_URL}/${playbackId}.m3u8`;

  if (requireSigned && !shouldSign) {
    throw new AppError('Mux signed playback is not configured', 500, 'MUX_SIGNING_CONFIG_MISSING');
  }

  // Public policy: no tokens needed
  if (!shouldSign) {
    return {
      type: 'mux',
      playbackId,
      manifestUrl,
      tokens: null,
      expiresAt,
    };
  }

  // Signed policy: generate all 3 JWT tokens (playback, thumbnail, storyboard)
  const nowSeconds = Math.floor(Date.now() / 1000);
  const sessionExpirySeconds = Math.floor(new Date(expiresAt).getTime() / 1000);
  const configuredTtl = parseInt(process.env.MUX_SIGNED_URL_TTL_SECONDS || '0', 10);
  // A token must never outlive the server-enforced playback session.  Duration
  // based tokens made it possible to keep watching after billing had stopped.
  const configuredExpirySeconds = configuredTtl > 0 ? nowSeconds + configuredTtl : sessionExpirySeconds;
  const exp = Math.min(sessionExpirySeconds, configuredExpirySeconds);

  const playbackToken = signMuxJwt(playbackId, 'v', exp, keyId, privateKey, {
    custom: { session_id: sessionId },
  });
  const thumbnailToken = signMuxJwt(playbackId, 't', exp, keyId, privateKey);
  const storyboardToken = signMuxJwt(playbackId, 's', exp, keyId, privateKey);

  return {
    type: 'mux',
    playbackId,
    tokens: {
      playback: playbackToken,
      thumbnail: thumbnailToken,
      storyboard: storyboardToken,
    },
    expiresAt,
  };
}
