import crypto from 'crypto';

const ATTENTION_SECRET = process.env.ATTENTION_HMAC_SECRET || 'attention-verification-secret-key';
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
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate challenge data based on type
 */
function generateChallengeData(type) {
  switch (type) {
    case 'color': {
      // Pick a random target color and 3 distractors
      const shuffled = [...COLORS].sort(() => Math.random() - 0.5);
      const target = shuffled[0];
      const options = shuffled.slice(0, 4).sort(() => Math.random() - 0.5);
      return {
        question: `اضغط على اللون ${target.name}`,
        questionEn: `Tap the ${target.nameEn} color`,
        options: options.map(c => ({ nameEn: c.nameEn, hex: c.hex })),
        correctAnswer: target.nameEn
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

    case 'confirm':
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
 * Uses primarily 'color' type with occasional 'math' for variety.
 */
export async function generateChallenges({ supabase, courseId, sessionId, userId, courseDuration, intervalMin, intervalMax }) {
  const challenges = [];
  let currentSecond = randomInt(intervalMin, intervalMax);

  while (currentSecond < courseDuration) {
    // Predominantly use color type (70%), with some math (30%)
    const rand = Math.random();
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
    console.error('Error inserting attention challenges:', error);
    throw error;
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
    return { error: 'Invalid session', status: 403 };
  }

  if (session.status !== 'active') {
    return { error: 'Session is no longer active', status: 400 };
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
    .single();

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
    return { error: 'Challenge not found', status: 404 };
  }

  if (challenge.custom_user_id !== userId) {
    return { error: 'Unauthorized', status: 403 };
  }

  if (challenge.session_id !== sessionId) {
    return { error: 'Session mismatch', status: 400 };
  }

  if (challenge.status !== 'pending') {
    return { error: 'Challenge already responded to', status: 400 };
  }

  // Verify HMAC: recompute and compare
  const expectedToken = computeHmacToken(challengeId, answer);
  const passed = crypto.timingSafeEqual(
    Buffer.from(challenge.challenge_token, 'hex'),
    Buffer.from(expectedToken, 'hex')
  );

  const newStatus = passed ? 'passed' : 'failed';

  // Update the challenge record
  await supabase
    .from('attention_checks')
    .update({
      status: newStatus,
      responded_at: new Date().toISOString()
    })
    .eq('id', challengeId);

  // Fetch the session to update counters
  const { data: session } = await supabase
    .from('course_playback_sessions')
    .select('id, attention_failures, course_id')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return { error: 'Session not found', status: 404 };
  }

  // Fetch course to get max failures
  const { data: course } = await supabase
    .from('video_courses')
    .select('attention_max_failures')
    .eq('id', session.course_id)
    .single();

  const maxFailures = course?.attention_max_failures || 3;
  let newFailures = session.attention_failures;
  let sessionTerminated = false;

  if (!passed) {
    newFailures += 1;

    if (newFailures >= maxFailures) {
      // Terminate the session
      sessionTerminated = true;
      await supabase
        .from('course_playback_sessions')
        .update({
          status: 'terminated',
          attention_failures: newFailures
        })
        .eq('id', sessionId);

      // Mark all remaining pending challenges as expired
      await supabase
        .from('attention_checks')
        .update({ status: 'expired' })
        .eq('session_id', sessionId)
        .eq('status', 'pending');
    } else {
      await supabase
        .from('course_playback_sessions')
        .update({ attention_failures: newFailures })
        .eq('id', sessionId);
    }
  }

  // Calculate attention score
  const { data: allChecks } = await supabase
    .from('attention_checks')
    .select('status')
    .eq('session_id', sessionId)
    .neq('status', 'pending');

  const responded = allChecks || [];
  const passedCount = responded.filter(c => c.status === 'passed').length;
  const totalResponded = responded.length;
  const attentionScore = totalResponded > 0 ? Math.round((passedCount / totalResponded) * 100) : 100;

  // Update session attention score
  await supabase
    .from('course_playback_sessions')
    .update({ attention_score: attentionScore })
    .eq('id', sessionId);

  return {
    passed,
    session_terminated: sessionTerminated,
    attention_score: attentionScore,
    failures: newFailures,
    max_failures: maxFailures
  };
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
    .select('id, attention_score, attention_failures, status, course_id')
    .eq('id', sessionId)
    .single();

  if (!session || session.custom_user_id !== userId) {
    return { error: 'Session not found', status: 404 };
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
