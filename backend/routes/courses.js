import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateToken } from '../middleware/auth.js';
import { authenticateUser, optionalAuth } from '../middleware/userAuth.js';
import { listPublicCourses, getPublicCourseById, COURSE_PUBLIC_SELECT } from '../services/courses/courseCatalogService.js';
import { createPlaybackSession } from '../services/courses/coursePlaybackService.js';
import { consumePlaybackHeartbeat } from '../services/courses/courseBillingService.js';
import { buildSignedManifest } from '../services/courses/hlsService.js';

dotenv.config();

const router = express.Router();
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Get all courses (public)
router.get('/', async (req, res) => {
    try {
        const result = await listPublicCourses(supabase, req.query);
        res.json(result);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Get featured courses (public)
router.get('/featured', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('courses_public')
            .select(COURSE_PUBLIC_SELECT)
            .eq('is_featured', true)
            .limit(5);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching featured courses:', error);
        res.status(500).json({ error: 'Failed to fetch featured courses' });
    }
});

// Get single course details (public metadata + access flags)
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const course = await getPublicCourseById(supabase, id);

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        let hasAccess = course.billing_model !== 'per_course';
        const requiresAuth = !req.user;

        if (course.billing_model === 'per_course') {
            hasAccess = false;
            if (req.user) {
                const { data: access } = await supabase
                    .from('course_access')
                    .select('id')
                    .eq('custom_user_id', req.user.id)
                    .eq('course_id', id)
                    .single();

                if (access) {
                    hasAccess = true;
                }
            }
        } else if (!req.user) {
            hasAccess = false;
        }

        res.json({
            ...course,
            has_access: hasAccess,
            requires_auth: requiresAuth
        });
    } catch (error) {
        console.error('Error fetching course:', error);
        res.status(500).json({ error: 'Failed to fetch course' });
    }
});

// Create playback session and return descriptor
router.post('/:id/playback', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const result = await createPlaybackSession({
            supabase,
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
        res.status(500).json({ error: 'Failed to start playback' });
    }
});

// Heartbeat for per-minute billing
router.post('/:id/heartbeat', authenticateUser, async (req, res) => {
    try {
        const { session_id, seconds_delta, idempotency_key } = req.body || {};
        const seconds = Number(seconds_delta);
        if (!session_id || !Number.isFinite(seconds) || seconds <= 0) {
            return res.status(400).json({ error: 'session_id and seconds_delta are required' });
        }

        const result = await consumePlaybackHeartbeat({
            supabase,
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
        res.status(500).json({ error: 'Failed to consume credits' });
    }
});

// Signed HLS manifest endpoint
router.get('/:id/hls/manifest', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { session_id, playlist } = req.query;

        if (!session_id) {
            return res.status(400).json({ error: 'session_id is required' });
        }

        const { data: session } = await supabase
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

        const { data: course } = await supabase
            .from('video_courses')
            .select('playback_source, playback_provider')
            .eq('id', id)
            .single();

        if (!course || course.playback_provider !== 'hls') {
            return res.status(400).json({ error: 'HLS playback not available' });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const manifestResult = await buildSignedManifest({
            supabase,
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
        res.status(500).json({ error: 'Failed to generate HLS manifest' });
    }
});

// Purchase/Request Access (per-course billing)
router.post('/:id/access', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const idempotencyKey = req.body?.idempotency_key;

        // Check if already has access
        const { data: existingAccess } = await supabase
            .from('course_access')
            .select('id')
            .eq('custom_user_id', userId)
            .eq('course_id', id)
            .single();

        if (existingAccess) {
            return res.json({ success: true, message: 'لديك صلاحية الوصول بالفعل' });
        }

        if (idempotencyKey) {
            const { data: existingTx } = await supabase
                .from('credit_transactions')
                .select('id')
                .eq('custom_user_id', userId)
                .eq('related_entity_type', 'course_access')
                .eq('related_entity_id', id)
                .contains('metadata', { idempotency_key: idempotencyKey })
                .maybeSingle();

            if (existingTx) {
                return res.json({ success: true, message: 'تمت معالجة الطلب مسبقاً' });
            }
        }

        // Get course cost + billing model
        const { data: course } = await supabase
            .from('video_courses')
            .select('credits_required, title, billing_model')
            .eq('id', id)
            .single();

        if (!course) return res.status(404).json({ error: 'Course not found' });
        if (course.billing_model !== 'per_course') {
            return res.status(400).json({ error: 'This course uses per-minute billing' });
        }

        // Check user balance
        const { data: userCredits } = await supabase
            .from('user_credits')
            .select('balance, total_spent')
            .eq('custom_user_id', userId)
            .single();

        if (!userCredits) {
            await supabase.from('user_credits').upsert({
                custom_user_id: userId,
                balance: 0,
                total_earned: 0,
                total_spent: 0,
                video_watch_minutes: 0,
                article_credits: 0,
                updated_at: new Date()
            }, { onConflict: 'custom_user_id' });
        }

        const balance = userCredits?.balance || 0;

        if (balance < course.credits_required) {
            return res.status(400).json({
                error: 'رصيد غير كافي',
                required: course.credits_required,
                current: balance
            });
        }

        // Deduct credits and grant access
        const { error: updateError } = await supabase
            .from('user_credits')
            .update({
                balance: balance - course.credits_required,
                total_spent: (userCredits?.total_spent || 0) + course.credits_required,
                updated_at: new Date()
            })
            .eq('custom_user_id', userId);

        if (updateError) throw updateError;

        const { error: accessError } = await supabase
            .from('course_access')
            .insert({
                custom_user_id: userId,
                course_id: id,
                access_date: new Date()
            });

        if (accessError) {
            // Rollback credits (manual)
            await supabase.from('user_credits').update({ balance: balance }).eq('custom_user_id', userId);
            throw accessError;
        }

        // Log transaction
        await supabase.from('credit_transactions').insert({
            custom_user_id: userId,
            transaction_type: 'usage',
            amount: -course.credits_required,
            description: `شراء كورس: ${course.title}`,
            balance_before: balance,
            balance_after: balance - course.credits_required,
            related_entity_type: 'course_access',
            related_entity_id: id,
            metadata: idempotencyKey ? { idempotency_key: idempotencyKey } : undefined
        });

        res.json({ success: true, message: 'تم شراء الكورس بنجاح' });

    } catch (error) {
        console.error('Error purchasing course:', error);
        res.status(500).json({ error: 'Failed to purchase course' });
    }
});

// Generate Quiz (Admin only or automated)
router.post('/:id/generate-quiz', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: course } = await supabase
            .from('video_courses')
            .select('transcript, title')
            .eq('id', id)
            .single();

        if (!course || !course.transcript) {
            return res.status(400).json({ error: 'Course transcript not found' });
        }

        const prompt = `
    You are an expert educator. Create a quiz based on the following transcript for the course "${course.title}".
    
    Transcript:
    """
    ${course.transcript.substring(0, 10000)} ... (truncated if too long)
    """
    
    Generate 5 multiple-choice questions in JSON format.
    Each question should have:
    - question (string)
    - options (array of 4 strings)
    - correct_answer_index (number 0-3)
    
    Output JSON ONLY:
    [
      {
        "question": "...",
        "options": ["...", "...", "...", "..."],
        "correct_answer_index": 0
      }
    ]
    `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const questions = JSON.parse(jsonStr);

        // Save quiz
        const { data: quiz, error } = await supabase
            .from('quizzes')
            .insert({
                course_id: id,
                questions: questions
            })
            .select()
            .single();

        if (error) throw error;

        res.json(quiz);

    } catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({ error: 'Failed to generate quiz' });
    }
});

// Get Quiz
router.get('/:id/quiz', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Check if user has access to course
        const { data: access } = await supabase
            .from('course_access')
            .select('id')
            .eq('custom_user_id', userId)
            .eq('course_id', id)
            .single();

        if (!access) {
            return res.status(403).json({ error: 'You must purchase the course to take the quiz' });
        }

        const { data: quiz } = await supabase
            .from('quizzes')
            .select('*')
            .eq('course_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not available yet' });
        }

        // Remove correct answers before sending to client
        const clientQuestions = quiz.questions.map(q => ({
            question: q.question,
            options: q.options
        }));

        res.json({ id: quiz.id, questions: clientQuestions });

    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ error: 'Failed to fetch quiz' });
    }
});

// Submit Quiz
router.post('/:id/quiz/submit', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params; // course id
        const { quizId, answers } = req.body; // answers: [0, 1, 2, 0, 3] indices
        const userId = req.user.id;

        const { data: quiz } = await supabase
            .from('quizzes')
            .select('*')
            .eq('id', quizId)
            .single();

        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        let score = 0;
        const total = quiz.questions.length;

        quiz.questions.forEach((q, index) => {
            if (answers[index] === q.correct_answer_index) {
                score++;
            }
        });

        const percentage = Math.round((score / total) * 100);
        const passed = percentage >= 70; // 70% passing grade

        // Record attempt
        await supabase.from('user_quiz_attempts').insert({
            custom_user_id: userId,
            quiz_id: quizId,
            score: percentage,
            passed: passed
        });

        res.json({
            success: true,
            score: percentage,
            passed: passed,
            totalQuestions: total,
            correctAnswers: score
        });

    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.status(500).json({ error: 'Failed to submit quiz' });
    }
});

export default router;
