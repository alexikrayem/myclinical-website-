import axios from 'axios';
import path from 'path';
import { AppError, BadRequestError } from '../../utils/errors.js';

const DEFAULT_TTL = parseInt(process.env.HLS_SIGNED_URL_TTL || '600', 10);

export function parseSupabaseSource(source) {
  if (!source) return null;
  if (source.startsWith('supabase://')) {
    const stripped = source.replace('supabase://', '');
    const [bucket, ...rest] = stripped.split('/');
    if (!bucket || rest.length === 0) return null;
    const objectPath = rest.join('/').split('?')[0].split('#')[0];
    return { bucket, objectPath };
  }

  const storageMatch = source.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (storageMatch) {
    const objectPath = storageMatch[2].split('?')[0].split('#')[0];
    return { bucket: storageMatch[1], objectPath };
  }

  return null;
}

function isRelativeUri(uri) {
  return uri && !uri.startsWith('http://') && !uri.startsWith('https://');
}

function sanitizePlaylistPath(playlistPath) {
  if (!playlistPath) return null;
  if (playlistPath.includes('..') || playlistPath.startsWith('/')) {
    return null;
  }
  return playlistPath;
}

async function createSignedUrl(supabase, bucket, objectPath, ttlSeconds) {
  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(objectPath, ttlSeconds, { download: false });

  if (error) throw new AppError('Failed to create HLS signed URL', 500, 'HLS_URL_FAILED');
  return data.signedUrl;
}

async function rewriteUriLine(line, resolveUri, rewritePlaylist) {
  if (!line || line.startsWith('#')) return line;
  const uri = line.trim();
  if (!uri) return line;
  if (!isRelativeUri(uri)) return line;
  if (uri.endsWith('.m3u8')) {
    return rewritePlaylist(uri);
  }
  return await resolveUri(uri);
}

async function rewriteAttributeUri(line, resolveUri, rewritePlaylist) {
  if (!line.includes('URI="')) return line;
  const regex = /URI="([^"]+)"/g;
  let lastIndex = 0;
  let match = null;
  const parts = [];

  while ((match = regex.exec(line)) !== null) {
    parts.push(line.slice(lastIndex, match.index));
    const uri = match[1];
    let replacement = uri;
    if (isRelativeUri(uri)) {
      replacement = uri.endsWith('.m3u8') ? rewritePlaylist(uri) : await resolveUri(uri);
    }
    parts.push(`URI="${replacement}"`);
    lastIndex = regex.lastIndex;
  }

  parts.push(line.slice(lastIndex));
  return parts.join('');
}

export async function buildSignedManifest({ supabase, playbackSource, playlistPath, sessionId, courseId, baseUrl }) {
  const parsed = parseSupabaseSource(playbackSource);
  if (!parsed) {
    throw new BadRequestError('Unsupported playback source for HLS');
  }

  const safePlaylist = sanitizePlaylistPath(playlistPath);
  const baseDir = path.posix.dirname(parsed.objectPath);
  const targetPath = safePlaylist
    ? path.posix.join(baseDir, safePlaylist)
    : parsed.objectPath;

  const signedUrl = await createSignedUrl(supabase, parsed.bucket, targetPath, DEFAULT_TTL);
  const response = await axios.get(signedUrl);
  const manifestText = response.data;

  const resolveUri = async (relative) => {
    const resolvedPath = path.posix.join(baseDir, relative);
    return createSignedUrl(supabase, parsed.bucket, resolvedPath, DEFAULT_TTL);
  };

  const rewritePlaylist = (relative) => {
    const endpoint = `${baseUrl}/api/courses/${courseId}/hls/manifest`;
    const params = new URLSearchParams({
      session_id: sessionId,
      playlist: relative
    });
    return `${endpoint}?${params.toString()}`;
  };

  const lines = String(manifestText).split(/\r?\n/);
  const rewritten = [];

  for (const line of lines) {
    if (!line) {
      rewritten.push(line);
      continue;
    }

    if (line.startsWith('#')) {
      const updated = await rewriteAttributeUri(line, resolveUri, rewritePlaylist);
      rewritten.push(updated);
      continue;
    }

    const updatedLine = await rewriteUriLine(line, resolveUri, rewritePlaylist);
    rewritten.push(updatedLine);
  }

  return { manifest: rewritten.join('\n') };
}
