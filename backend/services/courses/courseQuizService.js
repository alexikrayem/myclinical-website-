import { AppError } from '../../utils/errors.js';

export async function generateQuizForCourse(supabase, model, courseId) {
  const { data: course } = await supabase
    .from('video_courses')
    .select('transcript, title')
    .eq('id', courseId)
    .single();

  if (!course || !course.transcript) {
    return { status: 400, body: { error: 'Course transcript not found' } };
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

  return { status: 200, body: quiz };
}

export async function getLatestQuizForCourse(supabase, { courseId, userId }) {
  const { data: access } = await supabase
    .from('course_access')
    .select('id')
    .eq('custom_user_id', userId)
    .eq('course_id', courseId)
    .single();

  if (!access) {
    return { status: 403, body: { error: 'You must purchase the course to take the quiz' } };
  }

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!quiz) {
    return { status: 404, body: { error: 'Quiz not available yet' } };
  }

  const clientQuestions = quiz.questions.map(q => ({
    question: q.question,
    options: q.options
  }));

  return { status: 200, body: { id: quiz.id, questions: clientQuestions } };
}

export async function submitQuizAnswers(supabase, { userId, quizId, answers }) {
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single();

  if (!quiz) {
    return { status: 404, body: { error: 'Quiz not found' } };
  }

  let score = 0;
  const total = quiz.questions.length;

  quiz.questions.forEach((q, index) => {
    if (answers[index] === q.correct_answer_index) {
      score++;
    }
  });

  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 70; // 70% passing grade

  await supabase.from('user_quiz_attempts').insert({
    custom_user_id: userId,
    quiz_id: quizId,
    score: percentage,
    passed: passed
  });

  return {
    status: 200,
    body: {
      success: true,
      score: percentage,
      passed: passed,
      totalQuestions: total,
      correctAnswers: score
    }
  };
}
