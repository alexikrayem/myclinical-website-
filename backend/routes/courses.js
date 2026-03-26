import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateToken } from '../middleware/auth.js';
import { authenticateUser, optionalAuth } from '../middleware/userAuth.js';
import { listPublicCourses, COURSE_PUBLIC_SELECT } from '../services/courses/courseCatalogService.js';
import { createPlaybackSession } from '../services/courses/coursePlaybackService.js';
import { consumePlaybackHeartbeat } from '../services/courses/courseBillingService.js';
import { buildSignedManifest } from '../services/courses/hlsService.js';
import { getNextChallenge, verifyChallenge, expireChallenge } from '../services/courses/attentionService.js';
import { supabaseAdmin, supabasePublic } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { getCourseAccessDetails } from '../services/courses/courseAccessService.js';
import { purchaseCourseAccess } from '../services/courses/coursePurchaseService.js';
import { generateQuizForCourse, getLatestQuizForCourse, submitQuizAnswers } from '../services/courses/courseQuizService.js';
import { validate, schemas } from '../middleware/validation.js';

dotenv.config();

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Get all courses (public)
router.get('/', validate(schemas.coursesList), asyncHandler(async (req, res) => {
    try {
        const result = await listPublicCourses(supabasePublic, req.query);
        res.json(result);
    } catch (error) {
        console.error('Error fetching courses:', error);
        throw new AppError('Failed to fetch courses', 500, 'COURSES_FETCH_FAILED');
    }
}));

// Get featured courses (public)
router.get('/featured', asyncHandler(async (req, res) => {
    try {
        const { data, error } = await supabasePublic
            .from('courses_public')
            .select(COURSE_PUBLIC_SELECT)
            .eq('is_featured', true)
            .limit(5);

        if (error) {
            throw new AppError('Failed to fetch featured courses', 500, 'COURSES_FEATURED_FAILED');
        }
        res.json(data);
    } catch (error) {
        console.error('Error fetching featured courses:', error);
        throw new AppError('Failed to fetch featured courses', 500, 'COURSES_FEATURED_FAILED');
    }
}));

// Get single course details (public metadata + access flags)
router.get('/:id', optionalAuth, validate(schemas.courseById), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const accessDetails = await getCourseAccessDetails({
        supabasePublic,
        supabaseAdmin,
        courseId: id,
        user: req.user
    });

    res.json({
        ...accessDetails.course,
        has_access: accessDetails.has_access,
        requires_auth: accessDetails.requires_auth,
        applicable_typed_credits: accessDetails.applicable_typed_credits
    });
}));

// Create playback session and return descriptor
router.post('/:id/playback', authenticateUser, validate(schemas.coursePlayback), asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const result = await createPlaybackSession({
            supabase: supabaseAdmin,
            courseId: id,
            user: req.user,
            baseUrl
        });

        if (result?.error) {
            return res.status(result.status || 400).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        console.error('Error creating playback session:', error);
        throw new AppError('Failed to start playback', 500, 'COURSE_PLAYBACK_FAILED');
    }
}));

// Heartbeat for per-minute billing
router.post('/:id/heartbeat', authenticateUser, validate(schemas.courseHeartbeat), asyncHandler(async (req, res) => {
    try {
        const { session_id, seconds_delta, idempotency_key } = req.body || {};
        const seconds = Number(seconds_delta);

        const result = await consumePlaybackHeartbeat({
            supabase: supabaseAdmin,
            sessionId: session_id,
            secondsDelta: seconds,
            idempotencyKey: idempotency_key,
            customUserId: req.user.id
        });

        if (!result?.success) {
            return res.status(400).json({ error: result?.message || 'Failed to consume credits' });
        }

        res.json(result);
    } catch (error) {
        console.error('Error consuming playback heartbeat:', error);
        throw new AppError('Failed to consume credits', 500, 'COURSE_HEARTBEAT_FAILED');
    }
}));

// Signed HLS manifest endpoint
router.get('/:id/hls/manifest', authenticateUser, validate(schemas.courseHlsManifest), asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { session_id, playlist } = req.query;

        const { data: session } = await supabaseAdmin
            .from('course_playback_sessions')
            .select('id, course_id, custom_user_id, expires_at, status')
            .eq('id', session_id)
            .single();

        if (!session || session.course_id !== id || session.custom_user_id !== req.user.id) {
            return res.status(403).json({ error: 'Invalid playback session' });
        }

        if (session.status !== 'active' || new Date(session.expires_at) < new Date()) {
            return res.status(403).json({ error: 'Playback session expired' });
        }

        const { data: course } = await supabaseAdmin
            .from('video_courses')
            .select('playback_source, playback_provider')
            .eq('id', id)
            .single();

        if (!course || course.playback_provider !== 'hls') {
            return res.status(400).json({ error: 'HLS playback not available' });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const manifestResult = await buildSignedManifest({
            supabase: supabaseAdmin,
            playbackSource: course.playback_source,
            playlistPath: typeof playlist === 'string' ? playlist : null,
            sessionId: session_id,
            courseId: id,
            baseUrl
        });

        if (manifestResult?.error) {
            return res.status(manifestResult.status || 400).json({ error: manifestResult.error });
        }

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        res.send(manifestResult.manifest);
    } catch (error) {
        console.error('Error generating HLS manifest:', error);
        throw new AppError('Failed to generate HLS manifest', 500, 'COURSE_HLS_FAILED');
    }
}));

// Purchase/Request Access (per-course billing)
router.post('/:id/access', authenticateUser, validate(schemas.courseAccess), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const idempotencyKey = req.body?.idempotency_key;

    const result = await purchaseCourseAccess(supabaseAdmin, { courseId: id, userId, idempotencyKey });
    res.status(result.status).json(result.body);
}));

// Poll for attention check challenges
router.get('/:id/attention-check', authenticateUser, validate(schemas.courseAttentionCheck), asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { session_id, current_seconds } = req.query;

        const result = await getNextChallenge({
            supabase: supabaseAdmin,
            sessionId: session_id,
            currentSeconds: parseFloat(current_seconds),
            userId: req.user.id
        });

        if (result?.error) {
            return res.status(result.status || 400).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching attention check:', error);
        throw new AppError('Failed to fetch attention check', 500, 'COURSE_ATTENTION_CHECK_FAILED');
    }
}));

// Verify attention check answer
router.post('/:id/attention-check/verify', authenticateUser, validate(schemas.courseAttentionVerify), asyncHandler(async (req, res) => {
    try {
        const { session_id, challenge_id, answer, expired } = req.body || {};

        let result;
        if (expired) {
            // User timed out
            result = await expireChallenge({
                supabase: supabaseAdmin,
                challengeId: challenge_id,
                sessionId: session_id,
                userId: req.user.id
            });
        } else {
            result = await verifyChallenge({
                supabase: supabaseAdmin,
                challengeId: challenge_id,
                answer: answer || '',
                sessionId: session_id,
                userId: req.user.id
            });
        }

        if (result?.error) {
            return res.status(result.status || 400).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        console.error('Error verifying attention check:', error);
        throw new AppError('Failed to verify attention check', 500, 'COURSE_ATTENTION_VERIFY_FAILED');
    }
}));

// Generate Quiz (Admin only or automated)
router.post('/:id/generate-quiz', authenticateToken, validate(schemas.courseGenerateQuiz), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await generateQuizForCourse(supabaseAdmin, model, id);
    res.status(result.status).json(result.body);
}));

// Get Quiz
router.get('/:id/quiz', authenticateUser, validate(schemas.courseQuiz), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await getLatestQuizForCourse(supabaseAdmin, { courseId: id, userId });
    res.status(result.status).json(result.body);
}));

// Submit Quiz
router.post('/:id/quiz/submit', authenticateUser, validate(schemas.courseQuizSubmit), asyncHandler(async (req, res) => {
    const { quizId, answers } = req.body; // answers: [0, 1, 2, 0, 3] indices
    const userId = req.user.id;

    const result = await submitQuizAnswers(supabaseAdmin, { userId, quizId, answers });
    res.status(result.status).json(result.body);
}));

export default router;
