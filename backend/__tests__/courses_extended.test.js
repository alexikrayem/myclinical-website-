import { jest } from '@jest/globals';
import request from 'supertest';
import crypto from 'crypto';

// Setup environment for testing
process.env.ATTENTION_HMAC_SECRET = 'test-secret';

// Mock Auth
jest.unstable_mockModule('../middleware/userAuth.js', () => ({
    authenticateUser: (req, res, next) => {
        req.user = { id: 'user-123' };
        next();
    },
    optionalAuth: (req, res, next) => next()
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'admin-123', role: 'admin' };
        next();
    }
}));

// Mock Generative AI
const mockGenerateContent = jest.fn();
jest.unstable_mockModule('../config/gemini.js', () => ({
    getGenerativeModel: () => ({
        generateContent: mockGenerateContent
    })
}));

// Mock Validation Middleware
jest.unstable_mockModule('../middleware/validation.js', () => ({
    validate: () => (req, res, next) => next(),
    schemas: {
        courseAttentionCheck: {},
        courseAttentionVerify: {},
        courseGenerateQuiz: {},
        courseQuiz: {},
        courseQuizSubmit: {}
    }
}));

// Mock Supabase
const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    rpc: jest.fn()
};

jest.unstable_mockModule('../config/supabase.js', () => ({
    supabaseAdmin: mockSupabaseClient,
    supabasePublic: mockSupabaseClient
}));

// Load App
const { default: express } = await import('express');
const { default: coursesRouter } = await import('../routes/courses.js');
const { default: errorHandler } = await import('../middleware/errorHandler.js');

const app = express();
app.use(express.json());
app.use('/api/courses', coursesRouter);
if (errorHandler) app.use(errorHandler);

describe('Courses Extended API Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabaseClient.from.mockReturnThis();
        mockSupabaseClient.select.mockReturnThis();
        mockSupabaseClient.eq.mockReturnThis();
        mockSupabaseClient.lte.mockReturnThis();
        mockSupabaseClient.order.mockReturnThis();
        mockSupabaseClient.limit.mockReturnThis();
        mockSupabaseClient.single.mockReset();
        mockSupabaseClient.insert.mockReturnThis();
        mockSupabaseClient.rpc.mockReset();
    });

    describe('Attention Checks', () => {
        const courseId = 'course-1';
        const sessionId = 'session-1';

        test('GET /attention-check - Returns challenge when due', async () => {
            // Mock session query
            mockSupabaseClient.single.mockResolvedValueOnce({
                data: { id: sessionId, custom_user_id: 'user-123', status: 'active' },
                error: null
            });

            // Mock challenge query
            mockSupabaseClient.single.mockResolvedValueOnce({
                data: {
                    id: 'challenge-1',
                    challenge_type: 'math',
                    challenge_data: { question: '1+1' },
                    trigger_at_seconds: 10,
                    status: 'pending'
                },
                error: null
            });

            const res = await request(app).get(`/api/courses/${courseId}/attention-check?session_id=${sessionId}&current_seconds=15`);

            expect(res.status).toBe(200);
            expect(res.body.challenge.id).toBe('challenge-1');
            expect(res.body.challenge.type).toBe('math');
        });

        test('POST /attention-check/verify - Verifies answer correctly', async () => {
            // compute valid hmac
            const validToken = crypto.createHmac('sha256', process.env.ATTENTION_HMAC_SECRET)
                .update(`chal-1:answer`).digest('hex');

            // Mock Challenge query
            mockSupabaseClient.single.mockResolvedValueOnce({
                data: {
                    id: 'chal-1',
                    session_id: sessionId,
                    custom_user_id: 'user-123',
                    challenge_token: validToken,
                    status: 'pending'
                }
            });

            // Mock Session query
            mockSupabaseClient.single.mockResolvedValueOnce({
                data: { course_id: courseId }
            });

            // Mock Course query
            mockSupabaseClient.single.mockResolvedValueOnce({
                data: { attention_max_failures: 3 }
            });

            // Mock RPC
            mockSupabaseClient.rpc.mockResolvedValueOnce({
                data: { success: true },
                error: null
            });

            const res = await request(app).post(`/api/courses/${courseId}/attention-check/verify`)
                .send({
                    session_id: sessionId,
                    challenge_id: 'chal-1',
                    answer: 'answer'
                });

            expect(res.status).toBe(200);
            expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('verify_attention_challenge', expect.any(Object));
        });
    });

    describe('Quizzes', () => {

        const courseId = 'course-2';

        test('POST /generate-quiz - AI Generation', async () => {
            mockSupabaseClient.single.mockResolvedValueOnce({
                data: { transcript: 'This is a test transcript.', title: 'Course 2' } // course mock
            }).mockResolvedValueOnce({
                data: { id: 'quiz-1', questions: [] } // insert mock return
            });

            mockGenerateContent.mockResolvedValueOnce({
                response: {
                    text: () => JSON.stringify([
                        { question: 'Test Q?', options: ['A', 'B', 'C', 'D'], correct_answer_index: 0 }
                    ])
                }
            });

            const res = await request(app).post(`/api/courses/${courseId}/generate-quiz`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe('quiz-1');
            expect(mockGenerateContent).toHaveBeenCalled();
        });

        test('GET /quiz - Returns latest quiz if purchased', async () => {
            // Access
            mockSupabaseClient.single.mockResolvedValueOnce({ data: { id: 'access-1' } });
            // Quiz
            mockSupabaseClient.single.mockResolvedValueOnce({
                data: {
                    id: 'quiz-1',
                    questions: [
                        { question: 'Q', options: ['A', 'B', 'C', 'D'], correct_answer_index: 0 }
                    ]
                }
            });

            const res = await request(app).get(`/api/courses/${courseId}/quiz`);

            expect(res.status).toBe(200);
            expect(res.body.questions[0].correct_answer_index).toBeUndefined(); // should not send answer to client
        });

        test('POST /quiz/submit - Grade answers', async () => {
            // Get Quiz
            mockSupabaseClient.single.mockResolvedValueOnce({
                data: {
                    id: 'quiz-1',
                    course_id: courseId,
                    questions: [
                        { question: 'Q', options: ['A', 'B', 'C', 'D'], correct_answer_index: 1 }
                    ]
                }
            });

            const res = await request(app).post(`/api/courses/${courseId}/quiz/submit`)
                .send({
                    quizId: 'quiz-1',
                    answers: [1] // Correct
                });

            expect(res.status).toBe(200);
            expect(res.body.passed).toBe(true);
            expect(res.body.score).toBe(100);
            expect(mockSupabaseClient.insert).toHaveBeenCalled();
        });

    });

});
