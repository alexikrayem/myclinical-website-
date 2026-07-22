import { getVdoPlaybackInfo } from '../vdoService.js';
import { parseSupabaseSource } from './hlsService.js';
import { createMuxPlaybackDescriptor } from './muxService.js';
import { generateChallenges } from './attentionService.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import logger from '../../config/logger.js';

const configuredSessionTtl = parseInt(process.env.PLAYBACK_SESSION_TTL_SECONDS || '75', 10);
// Media credentials are deliberately short-lived. The client renews a session
// before this window closes; a copied descriptor cannot be used for a full
// course after billing/access checks stop.
const PLAYBACK_SESSION_TTL_SECONDS = Math.min(Math.max(configuredSessionTtl, 60), 120);

const buildSessionExpiry = () => new Date(Date.now() + PLAYBACK_SESSION_TTL_SECONDS * 1000).toISOString();

const getCourse = async (supabase, courseId) => {
  const { data: course, error } = await supabase
    .from('video_courses')
    .select('id, title, playback_source, playback_provider, billing_model, minute_cost, credits_required, duration, attention_required, attention_check_interval_min, attention_check_interval_max')
    .eq('id', courseId)
    .single();
  if (error || !course) throw new NotFoundError('Course not found');
  return course;
};

const assertProviderCapabilities = (course) => {
  if (course.playback_provider === 'vdocipher' && course.attention_required) {
    throw new BadRequestError('VdoCipher playback does not support enforced attention checks');
  }
  if (course.billing_model !== 'per_minute') return;
  if (['vdocipher', 'youtube', 'mp4'].includes(course.playback_provider)) {
    throw new BadRequestError('Per-minute billing requires the Mux signed or authenticated HLS provider');
  }
  if (course.playback_provider === 'mux' && String(course.playback_source || '').startsWith('mux://public/')) {
    throw new BadRequestError('Per-minute billing requires signed Mux playback');
  }
};

async function reservePlaybackMinute({ supabase, sessionId, userId }) {
  const { data, error } = await supabase.rpc('reserve_video_playback_minutes', {
    p_session_id: sessionId,
    p_minutes: 1,
    p_custom_user_id: userId
  });
  if (error) throw new AppError('Failed to reserve playback credit', 500, 'PLAYBACK_RESERVATION_FAILED');
  if (!data?.success) throw new ForbiddenError(data?.message || 'رصيد غير كافي');
  return data;
}

async function buildPlaybackDescriptor({ course, sessionId, expiresAt, user, baseUrl }) {
  switch (course.playback_provider) {
    case 'vdocipher': {
      if (!course.playback_source) throw new BadRequestError('Missing playback source');
      if (process.env.MOCK_VIDEO_API === 'true') {
        return { type: 'mp4', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' };
      }
      try {
        const vdoPlayback = await getVdoPlaybackInfo(course.playback_source, { user });
        return { type: 'vdocipher', otp: vdoPlayback.otp, playbackInfo: vdoPlayback.playbackInfo };
      } catch (err) {
        logger.error('VdoCipher playback info acquisition failed', { error: err, playbackSource: course.playback_source });
        throw new AppError('Failed to get playback info', 502, 'VDO_PLAYBACK_INFO_FAILED');
      }
    }
    case 'hls': {
      if (!course.playback_source) throw new BadRequestError('Missing playback source');
      const supabaseSource = parseSupabaseSource(course.playback_source);
      return {
        type: 'hls',
        manifestUrl: supabaseSource ? `${baseUrl}/api/courses/${course.id}/hls/manifest?session_id=${sessionId}` : course.playback_source,
        expiresAt
      };
    }
    case 'mux':
      if (!course.playback_source) throw new BadRequestError('Missing playback source');
      return createMuxPlaybackDescriptor({ playbackSource: course.playback_source, sessionId, expiresAt });
    case 'youtube':
      if (!course.playback_source) throw new BadRequestError('Missing playback source');
      return { type: 'youtube', url: course.playback_source };
    case 'mp4':
    default:
      if (!course.playback_source) throw new BadRequestError('Missing playback source');
      return { type: 'mp4', url: course.playback_source };
  }
}

export async function createPlaybackSession({ supabase, courseId, user, baseUrl }) {
  const course = await getCourse(supabase, courseId);
  assertProviderCapabilities(course);

  if (course.billing_model === 'per_course') {
    const { data: access } = await supabase
      .from('course_access')
      .select('id')
      .eq('custom_user_id', user.id)
      .eq('course_id', courseId)
      .single();

    if (!access) {
      throw new ForbiddenError('Course access required');
    }
  }

  let creditsSummary = null;
  if (course.billing_model === 'per_minute') {
    const { data: credits } = await supabase
      .from('user_credits')
      .select('video_watch_minutes, balance')
      .eq('custom_user_id', user.id)
      .single();

    creditsSummary = {
      remaining_minutes: credits?.video_watch_minutes || 0,
      remaining_balance: credits?.balance || 0,
    };
  }

  const expiresAt = buildSessionExpiry();
  const { data: session, error: sessionError } = await supabase
    .from('course_playback_sessions')
    .insert({
      course_id: courseId,
      custom_user_id: user.id,
      provider: course.playback_provider,
      expires_at: expiresAt
    })
    .select()
    .single();

  if (sessionError) {
    logger.error('Failed to insert new playback session', { error: sessionError, courseId, userId: user.id });
    throw new AppError('Failed to create playback session', 500, 'PLAYBACK_SESSION_CREATE_FAILED');
  }

  if (course.billing_model === 'per_minute') {
    try {
      const reservation = await reservePlaybackMinute({ supabase, sessionId: session.id, userId: user.id });
      creditsSummary = {
        remaining_minutes: reservation.remaining_minutes,
        remaining_balance: reservation.remaining_balance
      };
    } catch (err) {
      // Preserve the reservation failure even if best-effort cleanup is
      // unavailable (for example during a transient database outage).
      try {
        await supabase.from('course_playback_sessions').update({ status: 'terminated' }).eq('id', session.id);
      } catch (cleanupError) {
        logger.warn('Failed to terminate unreserved playback session', { cleanupError, sessionId: session.id });
      }
      throw err;
    }
  }

  const playback = await buildPlaybackDescriptor({ course, sessionId: session.id, expiresAt, user, baseUrl });

  // Generate attention challenges if the course requires it
  let attentionInfo = null;
  if (course.attention_required && course.duration > 0) {
    try {
      attentionInfo = await generateChallenges({
        supabase,
        courseId,
        sessionId: session.id,
        userId: user.id,
        courseDuration: course.duration,
        intervalMin: course.attention_check_interval_min || 180,
        intervalMax: course.attention_check_interval_max || 420
      });
    } catch (err) {
      logger.error('Failed to generate attention challenges:', { error: err, courseId, sessionId: session.id });
      // Non-fatal: playback can proceed, but attention won't be tracked
    }
  }

  return {
    session_id: session.id,
    expires_at: expiresAt,
    playback,
    billing_model: course.billing_model,
    minute_cost: course.minute_cost,
    credits: creditsSummary,
    attention_required: course.attention_required || false,
    attention: attentionInfo
  };
}

export async function refreshPlaybackSession({ supabase, courseId, sessionId, user, baseUrl }) {
  const { data: session, error } = await supabase
    .from('course_playback_sessions')
    .select('id, course_id, custom_user_id, status, expires_at')
    .eq('id', sessionId)
    .single();

  if (error || !session || session.course_id !== courseId || session.custom_user_id !== user.id || session.status !== 'active') {
    throw new ForbiddenError('Invalid playback session');
  }

  const course = await getCourse(supabase, courseId);
  assertProviderCapabilities(course);
  let credits = null;
  if (course.billing_model === 'per_minute') {
    const reservation = await reservePlaybackMinute({ supabase, sessionId, userId: user.id });
    credits = { remaining_minutes: reservation.remaining_minutes, remaining_balance: reservation.remaining_balance };
  }

  const expiresAt = buildSessionExpiry();
  const { error: updateError } = await supabase
    .from('course_playback_sessions')
    .update({ expires_at: expiresAt })
    .eq('id', sessionId)
    .eq('status', 'active');
  if (updateError) throw new AppError('Failed to renew playback session', 500, 'PLAYBACK_SESSION_REFRESH_FAILED');

  return {
    session_id: sessionId,
    expires_at: expiresAt,
    playback: await buildPlaybackDescriptor({ course, sessionId, expiresAt, user, baseUrl }),
    credits
  };
}
