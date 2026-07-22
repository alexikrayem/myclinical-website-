import { jest } from '@jest/globals';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppError, BadRequestError } from '../../utils/errors.js';
import { createMuxPlaybackDescriptor, parseMuxPlaybackSource } from '../../services/courses/muxService.js';

describe('muxService Unit Tests', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        delete process.env.MUX_SIGNING_KEY_ID;
        delete process.env.MUX_SIGNING_PRIVATE_KEY;
        delete process.env.MUX_DEFAULT_PLAYBACK_POLICY;
        delete process.env.MUX_SIGNED_URL_TTL_SECONDS;
        delete process.env.MUX_REQUIRE_SIGNED_PLAYBACK;
        delete process.env.MUX_PLAYBACK_RESTRICTION_ID;
    });

    afterEach(() => {
        jest.clearAllMocks();
        process.env = originalEnv;
    });

    describe('parseMuxPlaybackSource', () => {
        it('should parse direct, mux URI, and stream URL playback IDs', () => {
            expect(parseMuxPlaybackSource('abc123XYZ_9').playbackId).toBe('abc123XYZ_9');
            expect(parseMuxPlaybackSource('mux://signed/abc123XYZ_9')).toEqual({
                playbackId: 'abc123XYZ_9',
                policy: 'signed'
            });
            expect(parseMuxPlaybackSource('https://stream.mux.com/abc123XYZ_9.m3u8').playbackId).toBe('abc123XYZ_9');
        });

        it('should reject invalid playback IDs', () => {
            expect(() => parseMuxPlaybackSource('bad/id')).toThrow(BadRequestError);
        });
    });

    describe('createMuxPlaybackDescriptor', () => {
        it('should return public Mux HLS URL with null tokens when signing is not configured', () => {
            const descriptor = createMuxPlaybackDescriptor({
                playbackSource: 'mux://public/abc123XYZ_9',
                sessionId: 'session-1',
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                durationSeconds: 120
            });

            expect(descriptor).toMatchObject({
                type: 'mux',
                playbackId: 'abc123XYZ_9',
                manifestUrl: 'https://stream.mux.com/abc123XYZ_9.m3u8',
                tokens: null,
            });
        });

        it('should generate all 3 JWT tokens (v, t, s) when signing keys are configured', () => {
            const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
            process.env.MUX_SIGNING_KEY_ID = 'mux-key-1';
            process.env.MUX_SIGNING_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

            const descriptor = createMuxPlaybackDescriptor({
                playbackSource: 'abc123XYZ_9',
                sessionId: 'session-1',
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                durationSeconds: 120
            });

            // manifestUrl should include the playback token for HLS.js / Safari fallback
            expect(descriptor.manifestUrl).toContain('https://stream.mux.com/abc123XYZ_9.m3u8?token=');

            // All 3 tokens must be present
            expect(descriptor.tokens).toBeDefined();
            expect(typeof descriptor.tokens.playback).toBe('string');
            expect(typeof descriptor.tokens.thumbnail).toBe('string');
            expect(typeof descriptor.tokens.storyboard).toBe('string');

            // Decode and verify claims for each token
            const decodedPlayback = jwt.decode(descriptor.tokens.playback);
            expect(decodedPlayback).toMatchObject({
                sub: 'abc123XYZ_9',
                aud: 'v',
                kid: 'mux-key-1',
                custom: { session_id: 'session-1' }
            });

            const decodedThumbnail = jwt.decode(descriptor.tokens.thumbnail);
            expect(decodedThumbnail).toMatchObject({
                sub: 'abc123XYZ_9',
                aud: 't',
                kid: 'mux-key-1',
            });
            // Thumbnail token should NOT carry session_id or custom claims
            expect(decodedThumbnail.custom).toBeUndefined();

            const decodedStoryboard = jwt.decode(descriptor.tokens.storyboard);
            expect(decodedStoryboard).toMatchObject({
                sub: 'abc123XYZ_9',
                aud: 's',
                kid: 'mux-key-1',
            });
        });

        it('should set playback_restriction_id only on the playback (v) token', () => {
            const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
            process.env.MUX_SIGNING_KEY_ID = 'mux-key-1';
            process.env.MUX_SIGNING_PRIVATE_KEY = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
            process.env.MUX_PLAYBACK_RESTRICTION_ID = 'restrict-abc';

            const descriptor = createMuxPlaybackDescriptor({
                playbackSource: 'abc123XYZ_9',
                sessionId: 'session-1',
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
            });

            const decodedPlayback = jwt.decode(descriptor.tokens.playback);
            expect(decodedPlayback.playback_restriction_id).toBe('restrict-abc');

            const decodedThumbnail = jwt.decode(descriptor.tokens.thumbnail);
            expect(decodedThumbnail.playback_restriction_id).toBeUndefined();
        });

        it('should fail closed when signed playback is required but keys are missing', () => {
            expect(() => createMuxPlaybackDescriptor({
                playbackSource: 'mux://signed/abc123XYZ_9',
                sessionId: 'session-1',
                expiresAt: new Date(Date.now() + 60_000).toISOString()
            })).toThrow(AppError);
        });
    });
});
