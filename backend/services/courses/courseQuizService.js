import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { QUIZ_SELECT } from '../../utils/queryFields.js';
import { z } from 'zod';
import { getGenerativeModel } from '../../config/gemini.js';
import logger from '../../config/logger.js';

const QuizSchema = z.array(z.object({
  question: z.string().min(1),
  options: z.array(z.string()).length(4),
  correct_answer_index: z.number().int().min(0).max(3)
})).min(1).max(10);
export async function generateQuizForCourse(supabase, courseId) {
  const model = getGenerativeModel();
  if (!model) {
    throw new AppError('AI model is not configured', 501, 'AI_DISABLED');
  }

  const { data: course } = await supabase
    .from('video_courses')
    .select('transcript, title')
    .eq('id', courseId)
    .single();

  if (!course || !course.transcript) {
    throw new BadRequestError('Course transcript not found');
  }

  const sanitizedTranscript = course.transcript.replace(/[^\w\s\.,;:\?!'\/\(\)-]/g, " ").substring(0, 10000);
  const sanitizedTitle = course.title.replace(/[^\w\s\.,;:\?!'\/\(\)-]/g, " ").substring(0, 200).trim();

  const prompt = `
    You are an expert educator. Create a quiz based on the following transcript for the course "${sanitizedTitle}".
    
    Transcript:
    """
    ${sanitizedTranscript} ... (truncated if too long)
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

  let result;
  let responseText;
  try {
    result = await model.generateContent(prompt);
    responseText = result.response.text();
  } catch (error) {
    logger.error('Failed to generate quiz content via AI:', { error });
    throw new AppError('فشل توليد الاختبار بسبب خطأ في الذكاء الاصطناعي', 502, 'COURSE_QUIZ_GENERATE_FAILED');
  }

  const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

  let questions;
  try {
    questions = QuizSchema.parse(JSON.parse(jsonStr));
  } catch (err) {
    throw new AppError('AI generated invalid quiz schema', 500, 'COURSE_QUIZ_INVALID_SCHEMA');
  }

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .insert({
      course_id: courseId,
      questions: questions
    })
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to generate quiz', 500, 'COURSE_QUIZ_GENERATE_FAILED');
  }

  return quiz;
}

export async function getLatestQuizForCourse(supabase, { courseId, userId }) {
  const { data: access } = await supabase
    .from('course_access')
    .select('id')
    .eq('custom_user_id', userId)
    .eq('course_id', courseId)
    .single();

  if (!access) {
    throw new ForbiddenError('You must purchase the course to take the quiz');
  }

  const { data: quiz } = await supabase
    .from('quizzes')
    .select(QUIZ_SELECT)
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!quiz) {
    throw new NotFoundError('Quiz not available yet');
  }

  const clientQuestions = quiz.questions.map(q => ({
    question: q.question,
    options: q.options
  }));

  return { id: quiz.id, questions: clientQuestions };
}

export async function submitQuizAnswers(supabase, { userId, quizId, answers }) {
  if (!Array.isArray(answers)) {
    throw new BadRequestError('Answers must be an array');
  }

  const { data: quiz } = await supabase
    .from('quizzes')
    .select(QUIZ_SELECT)
    .eq('id', quizId)
    .single();

  if (!quiz) {
    throw new NotFoundError('Quiz not found');
  }

  const total = quiz.questions.length;
  if (answers.length !== total) {
    throw new BadRequestError(`Expected ${total} answers, received ${answers.length}`);
  }

  for (const ans of answers) {
    if (!Number.isInteger(ans) || ans < 0 || ans > 3) {
      throw new BadRequestError('Each answer must be an integer between 0 and 3');
    }
  }

  let score = 0;

  quiz.questions.forEach((q, index) => {
    if (answers[index] === q.correct_answer_index) {
      score++;
    }
  });

  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 70; // 70% passing grade

  const { error: insertError } = await supabase.from('user_quiz_attempts').insert({
    custom_user_id: userId,
    quiz_id: quizId,
    score: percentage,
    passed: passed
  });

  if (insertError) {
    throw new AppError('Failed to save quiz attempt', 500, 'QUIZ_ATTEMPT_SAVE_FAILED');
  }

  return {
    success: true,
    score: percentage,
    passed: passed,
    totalQuestions: total,
    correctAnswers: score
  };
}
