import crypto from 'crypto';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import logger from '../../config/logger.js';

const ATTENTION_SECRET = process.env.ATTENTION_HMAC_SECRET;
if (!ATTENTION_SECRET) {
  throw new Error('FATAL: ATTENTION_HMAC_SECRET environment variable is required');
}
const CHALLENGE_TIMEOUT_SECONDS = 15;

// Available colors for color-pick challenges
const COLORS = [
  { name: 'أحمر', nameEn: 'red', hex: '#EF4444' },
  { name: 'أزرق', nameEn: 'blue', hex: '#3B82F6' },
  { name: 'أخضر', nameEn: 'green', hex: '#22C55E' },
  { name: 'أصفر', nameEn: 'yellow', hex: '#EAB308' },
  { name: 'بنفسجي', nameEn: 'purple', hex: '#A855F7' },
  { name: 'برتقالي', nameEn: 'orange', hex: '#F97316' },
  { name: 'وردي', nameEn: 'pink', hex: '#EC4899' },
  { name: 'سماوي', nameEn: 'cyan', hex: '#06B6D4' }
];

/**
 * Generate HMAC token for a challenge
 */
function computeHmacToken(challengeId, expectedAnswer) {
  return crypto
    .createHmac('sha256', ATTENTION_SECRET)
    .update(`${challengeId}:${expectedAnswer}`)
    .digest('hex');
}

/**
 * Generate random integer between min and max (inclusive)
 */
function randomInt(min, max) {
  // crypto.randomInt is exclusive of the maximum limit
  return crypto.randomInt(min, max + 1);
}

/**
 * Securely shuffle an array using Fisher-Yates and cryptographic randomness
 */
function secureShuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate challenge data based on type
 */
function generateChallengeData(type) {
  switch (type) {
    case 'color': {
      // Pick a random target color and 3 distractors
      const shuffled = secureShuffle(COLORS);
      const target = shuffled[0];
      const options = secureShuffle(shuffled.slice(0, 4));
      const optionsWithIds = options.map(c => ({ id: crypto.randomUUID(), hex: c.hex, isTarget: c.nameEn === target.nameEn }));
      const targetOption = optionsWithIds.find(option => option.isTarget);
      return {
        question: `اضغط على اللون ${target.name}`,
        questionEn: `Tap the ${target.nameEn} color`,
        // Only opaque option identifiers reach the browser. The answer mapping
        // remains in the HMAC and is never serialised with the challenge.
        options: optionsWithIds.map(({ id, hex }) => ({ id, hex })),
        correctAnswer: targetOption.id
      };
    }

    case 'math': {
      const a = randomInt(1, 20);
      const b = randomInt(1, 20);
      const ops = ['+', '-'];
      const op = ops[randomInt(0, ops.length - 1)];
      const answer = op === '+' ? a + b : a - b;
      return {
        question: `ما ناتج ${a} ${op} ${b}؟`,
        questionEn: `What is ${a} ${op} ${b}?`,
        correctAnswer: String(answer)
      };
    }

    default:
      return {
        question: 'هل أنت لا تزال تشاهد؟ اضغط للتأكيد',
        questionEn: 'Are you still watching? Press to confirm',
        correctAnswer: 'confirmed'
      };
  }
}

/**
 * Generate all challenges for a playback session at random intervals
 * throughout the course duration.
 * 
 * Uses primarily 'color' type with occasional 'math' for variety. A fixed
 * "confirm" response is intentionally not generated: it offered no actual
 * verification and could be answered without observing the challenge.
 */
export async function generateChallenges({ supabase, courseId, sessionId, userId, courseDuration, intervalMin, intervalMax }) {
  const challenges = [];
  let currentSecond = randomInt(intervalMin, intervalMax);

  while (currentSecond < courseDuration) {
    // Predominantly use color type (70%), with some math (30%)
    const rand = crypto.randomInt(0, 100) / 100;
    const challengeType = rand < 0.7 ? 'color' : 'math';

    const data = generateChallengeData(challengeType);
    const challengeId = crypto.randomUUID();
    const token = computeHmacToken(challengeId, data.correctAnswer);

    challenges.push({
      id: challengeId,
      session_id: sessionId,
      custom_user_id: userId,
      challenge_type: challengeType,
      challenge_data: {
        question: data.question,
        questionEn: data.questionEn,
        options: data.options || null
      },
      challenge_token: token,
      trigger_at_seconds: currentSecond,
      status: 'pending'
    });

    // Next challenge at a random interval
    currentSecond += randomInt(intervalMin, intervalMax);
  }

  if (challenges.length === 0) {
    return { total: 0, first_check_at: null };
  }

  // Bulk insert all challenges
  const { error } = await supabase
    .from('attention_checks')
    .insert(challenges);

  if (error) {
    logger.error('Error inserting attention challenges:', { error, courseId, sessionId });
    throw new AppError('Failed to generate challenges', 500, 'CHALLENGE_GENERATION_FAILED');
  }

  return {
    total: challenges.length,
    first_check_at: challenges[0].trigger_at_seconds
  };
}

/**
 * Get the next pending challenge for a session if the user has reached its trigger time.
 * Returns null if no challenge is due yet.
 */
export async function getNextChallenge({ supabase, sessionId, currentSeconds, userId }) {
  // First validate the session belongs to this user and is active
  const { data: session } = await supabase
    .from('course_playback_sessions')
    .select('id, custom_user_id, status, expires_at')
    .eq('id', sessionId)
    .single();

  if (!session || session.custom_user_id !== userId) {
    throw new ForbiddenError('Invalid session');
  }

  if (session.status !== 'active') {
    throw new BadRequestError('Session is no longer active');
  }
  
  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    throw new ForbiddenError('Session has expired');
  }

  // Find the earliest pending challenge where trigger_at_seconds <= currentSeconds
  const { data: challenge, error } = await supabase
    .from('attention_checks')
    .select('id, challenge_type, challenge_data, trigger_at_seconds, status')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .lte('trigger_at_seconds', currentSeconds)
    .order('trigger_at_seconds', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !challenge) {
    // No challenge due yet - this is normal
    return { challenge: null };
  }

  return {
    challenge: {
      id: challenge.id,
      type: challenge.challenge_type,
      data: challenge.challenge_data,
      trigger_at_seconds: challenge.trigger_at_seconds,
      timeout_seconds: CHALLENGE_TIMEOUT_SECONDS
    }
  };
}

/**
 * Verify a challenge answer.
 * Returns { passed, session_terminated, attention_score, failures }
 */
export async function verifyChallenge({ supabase, challengeId, answer, sessionId, userId }) {
  // Fetch the challenge
  const { data: challenge, error } = await supabase
    .from('attention_checks')
    .select('id, session_id, custom_user_id, challenge_token, challenge_data, status')
    .eq('id', challengeId)
    .single();

  if (error || !challenge) {
    throw new NotFoundError('Challenge not found');
  }

  if (challenge.custom_user_id !== userId) {
    throw new ForbiddenError('Unauthorized');
  }

  if (challenge.session_id !== sessionId) {
    throw new BadRequestError('Session mismatch');
  }

  if (challenge.status !== 'pending') {
    throw new BadRequestError('Challenge already responded to');
  }

  // Verify HMAC: recompute and compare
  const expectedToken = computeHmacToken(challengeId, answer);
  const storedBuf = Buffer.from(challenge.challenge_token, 'hex');
  const computedBuf = Buffer.from(expectedToken, 'hex');
  
  let passed = false;
  if (storedBuf.length === computedBuf.length) {
    passed = crypto.timingSafeEqual(storedBuf, computedBuf);
  }

  // Fetch course to get max failures
  const { data: session } = await supabase
    .from('course_playback_sessions')
    .select('course_id')
    .eq('id', sessionId)
    .single();

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  const { data: course } = await supabase
    .from('video_courses')
    .select('attention_max_failures')
    .eq('id', session.course_id)
    .single();

  const maxFailures = course?.attention_max_failures || 3;

  // Call the atomic RPC to verify and update
  const { data: rpcResult, error: rpcError } = await supabase.rpc('verify_attention_challenge', {
    p_challenge_id: challengeId,
    p_session_id: sessionId,
    p_user_id: userId,
    p_passed: passed,
    p_max_failures: maxFailures
  });

  if (rpcError) {
    throw new AppError('Failed to verify challenge', 500, 'VERIFY_CHALLENGE_FAILED');
  }
  
  if (rpcResult.error) {
    throw new AppError(rpcResult.error, rpcResult.status);
  }

  return rpcResult;
}

/**
 * Mark a challenge as expired (user didn't respond in time).
 * This counts as a failure.
 */
export async function expireChallenge({ supabase, challengeId, sessionId, userId }) {
  return verifyChallenge({
    supabase,
    challengeId,
    answer: '__timeout__',  // Will never match the HMAC
    sessionId,
    userId
  });
}

/**
 * Get the attention status for a session (used to gate quiz/license access).
 */
export async function getAttentionStatus({ supabase, sessionId, userId }) {
  const { data: session } = await supabase
    .from('course_playback_sessions')
    .select('id, custom_user_id, attention_score, attention_failures, status, course_id')
    .eq('id', sessionId)
    .single();

  if (!session || session.custom_user_id !== userId) {
    throw new NotFoundError('Session not found');
  }

  // Count total and remaining checks
  const { data: checks } = await supabase
    .from('attention_checks')
    .select('status')
    .eq('session_id', sessionId);

  const total = checks?.length || 0;
  const pending = checks?.filter(c => c.status === 'pending').length || 0;
  const passedCount = checks?.filter(c => c.status === 'passed').length || 0;

  return {
    attention_score: session.attention_score,
    failures: session.attention_failures,
    total_checks: total,
    completed_checks: total - pending,
    passed_checks: passedCount,
    session_status: session.status
  };
}
