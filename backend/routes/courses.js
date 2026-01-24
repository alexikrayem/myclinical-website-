import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { authenticateToken } from '../middleware/auth.js';
import { authenticateUser, optionalAuth } from '../middleware/userAuth.js';
import { getVdoPlaybackInfo } from '../services/vdoService.js';

dotenv.config();

const router = express.Router();
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Get all courses
router.get('/', async (req, res) => {
    try {
        const { category, search, limit = 12, page = 1, featured } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase.from('video_courses').select('*', { count: 'exact' });

        if (category) {
            query = query.contains('categories', [category]);
        }

        if (featured === 'true') {
            query = query.eq('is_featured', true);
        }

        if (search) {
            query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,author.ilike.%${search}%`);
        }

        const { data, error, count } = await query
            .order('publication_date', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (error) throw error;

        res.json({
            data,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Get featured courses
router.get('/featured', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('video_courses')
            .select('*')
            .eq('is_featured', true)
            .limit(5);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching featured courses:', error);
        res.status(500).json({ error: 'Failed to fetch featured courses' });
    }
});

// Get single course details
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch course data
        const { data: course, error } = await supabase
            .from('video_courses')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // 2. Check access permissions
        let hasAccess = false;

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

        // 3. Filter sensitive data if no access
        if (!hasAccess) {
            // Remove video_url and transcript from response
            const { video_url, transcript, ...publicData } = course;
            return res.json({ ...publicData, has_access: false });
        }

        // 4. If has access, get VdoCipher playback info if video_url looks like an ID
        let vdoPlayback = null;
        if (course.video_url && !course.video_url.startsWith('http')) {
            try {
                vdoPlayback = await getVdoPlaybackInfo(course.video_url, { user: req.user });
            } catch (vdoError) {
                console.error('VdoCipher Error:', vdoError.message);
                // Continue without vdoPlayback, frontend will handle the error
            }
        }

        // Return full data if access granted
        res.json({
            ...course,
            has_access: true,
            vdo_playback: vdoPlayback
        });

    } catch (error) {
        console.error('Error fetching course:', error);
        res.status(500).json({ error: 'Failed to fetch course' });
    }
});

// Purchase/Request Access
router.post('/:id/access', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

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

        // Get course cost
        const { data: course } = await supabase
            .from('video_courses')
            .select('credits_required, title')
            .eq('id', id)
            .single();

        if (!course) return res.status(404).json({ error: 'Course not found' });

        // Check user balance
        const { data: userCredits } = await supabase
            .from('user_credits')
            .select('balance, total_spent')
            .eq('custom_user_id', userId)
            .single();

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
            related_entity_id: id
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

        // Check admin permissions (optional, for now allow authenticated users to trigger for demo)
        // if (!req.admin) return res.status(403).json({ error: 'Unauthorized' });

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
