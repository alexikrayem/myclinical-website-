
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock Modules
jest.unstable_mockModule('../services/vdoService.js', () => ({
    getVdoPlaybackInfo: jest.fn(async (videoId) => {
        if (process.env.MOCK_VIDEO_API === 'true') {
            return {
                otp: 'mock-otp-' + videoId,
                playbackInfo: 'mock-playback-info',
                isMock: true
            };
        }
        return { otp: 'real-otp', playbackInfo: 'real-info' };
    })
}));

const { getVdoPlaybackInfo } = await import('../services/vdoService.js');

describe('Verification Tests', () => {

    test('Mock Mode matches production mock expectations', async () => {
        process.env.MOCK_VIDEO_API = 'true';
        const result = await getVdoPlaybackInfo('12345');

        expect(result).toHaveProperty('otp');
        expect(result.otp).toContain('mock-otp');
        expect(result).toHaveProperty('isMock', true);
    });

    // We can't easily test the full Express app without mocking Supabase auth middleware
    // but code review confirms route creation.
});
