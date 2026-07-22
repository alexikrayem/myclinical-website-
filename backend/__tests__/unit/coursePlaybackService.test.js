import { jest } from '@jest/globals';
import { NotFoundError, ForbiddenError, BadRequestError, AppError } from '../../utils/errors.js';

jest.unstable_mockModule('../../services/vdoService.js', () => ({
    getVdoPlaybackInfo: jest.fn()
}));

jest.unstable_mockModule('../../services/courses/attentionService.js', () => ({
    generateChallenges: jest.fn()
}));

const coursePlaybackService = await import('../../services/courses/coursePlaybackService.js');
const vdoService = await import('../../services/vdoService.js');
const attentionService = await import('../../services/courses/attentionService.js');

describe('coursePlaybackService Unit Tests', () => {
    let mockSupabase;
    let originalEnv;

    beforeEach(() => {
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            rpc: jest.fn(),
            single: jest.fn()
        };

        vdoService.getVdoPlaybackInfo.mockResolvedValue({ otp: 'mock-otp', playbackInfo: 'mock-info' });
        attentionService.generateChallenges.mockResolvedValue([{ id: 1, trigger_time: 10 }]);


        // Save env state
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        process.env = originalEnv;
    });

    describe('createPlaybackSession', () => {
        const payload = {
            courseId: 'c1',
            user: { id: 'u1' },
            baseUrl: 'http://localhost'
        };

        const mockDefaultCourse = {
            id: 'c1',
            billing_model: 'free',
            playback_provider: 'mp4',
            playback_source: 'http://video.mp4',
            attention_required: false
        };

        it('should throw NotFoundError if course does not exist', async () => {
            const p = { ...payload, supabase: { ...mockSupabase, single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }) } };
            await expect(coursePlaybackService.createPlaybackSession(p)).rejects.toThrow(NotFoundError);
        });

        it('should throw ForbiddenError if per_course and user lacks access', async () => {
            const courseData = { ...mockDefaultCourse, billing_model: 'per_course' };
            // First call (course), second call (access)
            const singleMock = jest.fn()
                .mockResolvedValueOnce({ data: courseData, error: null })
                .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

            const p = { ...payload, supabase: { ...mockSupabase, single: singleMock } };
            await expect(coursePlaybackService.createPlaybackSession(p)).rejects.toThrow(ForbiddenError);
        });

        it('should reject a per-minute session when the transactional reservation has no balance', async () => {
            const courseData = { ...mockDefaultCourse, billing_model: 'per_minute', minute_cost: 10, playback_provider: 'hls', playback_source: 'supabase://videos/test.m3u8' };
            const singleMock = jest.fn()
                .mockResolvedValueOnce({ data: courseData, error: null })
                .mockResolvedValueOnce({ data: { video_watch_minutes: 0, balance: 0 }, error: null })
                .mockResolvedValueOnce({ data: { id: 'sess_pm' }, error: null });

            const p = { ...payload, supabase: { ...mockSupabase, single: singleMock, rpc: jest.fn().mockResolvedValue({ data: { success: false, message: 'رصيد غير كافي' }, error: null }) } };
            await expect(coursePlaybackService.createPlaybackSession(p)).rejects.toThrow(ForbiddenError);
        });

        it('should successfully create session for vdocipher provider', async () => {
            const courseData = { ...mockDefaultCourse, playback_provider: 'vdocipher', playback_source: 'vdo_id' };
            // course call, session insert select
            const singleMock = jest.fn()
                .mockResolvedValueOnce({ data: courseData, error: null })
                .mockResolvedValueOnce({ data: { id: 'sess_1' }, error: null });

            const p = { ...payload, supabase: { ...mockSupabase, single: singleMock } };
            const result = await coursePlaybackService.createPlaybackSession(p);
            expect(result.session_id).toBe('sess_1');
            expect(result.playback.type).toBe('vdocipher');
            expect(vdoService.getVdoPlaybackInfo).toHaveBeenCalled();
        });

        it('should fallback to BigBuckBunny if MOCK_VIDEO_API is set to true', async () => {
            process.env.MOCK_VIDEO_API = 'true';

            const courseData = { ...mockDefaultCourse, playback_provider: 'vdocipher', playback_source: 'vdo_id' };
            const singleMock = jest.fn()
                .mockResolvedValueOnce({ data: courseData, error: null })
                .mockResolvedValueOnce({ data: { id: 'sess_2' }, error: null });

            const p = { ...payload, supabase: { ...mockSupabase, single: singleMock } };
            const result = await coursePlaybackService.createPlaybackSession(p);

            expect(result.playback.type).toBe('mp4');
            expect(result.playback.url).toContain('BigBuckBunny');
            expect(vdoService.getVdoPlaybackInfo).not.toHaveBeenCalled();
        });

        it('should successfully create session for hls provider with manifest generation', async () => {
            const courseData = { ...mockDefaultCourse, playback_provider: 'hls', playback_source: 'hls_id' };
            const singleMock = jest.fn()
                .mockResolvedValueOnce({ data: courseData, error: null })
                .mockResolvedValueOnce({ data: { id: 'sess_hls' }, error: null });

            const p = { ...payload, supabase: { ...mockSupabase, single: singleMock } };
            const result = await coursePlaybackService.createPlaybackSession(p);

            expect(result.session_id).toBe('sess_hls');
            expect(result.playback.type).toBe('hls');
            expect(result.playback.manifestUrl).toBeDefined();
        });

        it('should successfully create session for mux provider', async () => {
            const courseData = {
                ...mockDefaultCourse,
                playback_provider: 'mux',
                playback_source: 'mux://public/muxPlayback123',
                duration: 3600
            };
            const singleMock = jest.fn()
                .mockResolvedValueOnce({ data: courseData, error: null })
                .mockResolvedValueOnce({ data: { id: 'sess_mux' }, error: null });

            const p = { ...payload, supabase: { ...mockSupabase, single: singleMock } };
            const result = await coursePlaybackService.createPlaybackSession(p);

            expect(result.session_id).toBe('sess_mux');
            expect(result.playback.type).toBe('mux');
            expect(result.playback.manifestUrl).toBe('https://stream.mux.com/muxPlayback123.m3u8');
            expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now() + 59 * 1000);
            expect(new Date(result.expires_at).getTime()).toBeLessThanOrEqual(Date.now() + 120 * 1000);
        });

        it('should successfully create session for youtube provider', async () => {
            const courseData = { ...mockDefaultCourse, playback_provider: 'youtube', playback_source: 'yt_id' };
            const singleMock = jest.fn()
                .mockResolvedValueOnce({ data: courseData, error: null })
                .mockResolvedValueOnce({ data: { id: 'sess_yt' }, error: null });

            const p = { ...payload, supabase: { ...mockSupabase, single: singleMock } };
            const result = await coursePlaybackService.createPlaybackSession(p);

            expect(result.playback.type).toBe('youtube');
            expect(result.playback.url).toBe('yt_id');
        });

        it('should execute generation of attention checks if required', async () => {
            const courseData = { ...mockDefaultCourse, attention_required: true, duration: 3000 };
            const singleMock = jest.fn()
                .mockResolvedValueOnce({ data: courseData, error: null })
                .mockResolvedValueOnce({ data: { id: 'sess_3' }, error: null });

            const p = { ...payload, supabase: { ...mockSupabase, single: singleMock } };
            const result = await coursePlaybackService.createPlaybackSession(p);

            expect(result.attention_required).toBe(true);
            expect(attentionService.generateChallenges).toHaveBeenCalled();
            expect(result.attention).toBeDefined();
        });
    });
});
