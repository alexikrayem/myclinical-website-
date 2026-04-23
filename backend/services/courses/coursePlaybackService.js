import { getVdoPlaybackInfo } from '../vdoService.js';
import { parseSupabaseSource } from './hlsService.js';
import { generateChallenges } from './attentionService.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import logger from '../../config/logger.js';

const PLAYBACK_SESSION_TTL_SECONDS = parseInt(process.env.PLAYBACK_SESSION_TTL_SECONDS || '600', 10);

const buildSessionExpiry = () => new Date(Date.now() + PLAYBACK_SESSION_TTL_SECONDS * 1000).toISOString();

export async function createPlaybackSession({ supabase, courseId, user, baseUrl }) {
  const { data: course, error } = await supabase
    .from('video_courses')
    .select('id, title, playback_source, playback_provider, billing_model, minute_cost, credits_required, duration, attention_required, attention_check_interval_min, attention_check_interval_max')
    .eq('id', courseId)
    .single();

  if (error || !course) {
    throw new NotFoundError('Course not found');
  }

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

    const videoMinutes = credits?.video_watch_minutes || 0;
    const balance = credits?.balance || 0;
    creditsSummary = {
      remaining_minutes: videoMinutes,
      remaining_balance: balance
    };

    const minuteCost = course.minute_cost || 1;
    if (minuteCost > 0 && videoMinutes < minuteCost && balance < minuteCost) {
      throw new BadRequestError('رصيد غير كافي');
    }
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

  let playback = null;

  switch (course.playback_provider) {
    case 'vdocipher': {
      if (!course.playback_source) {
        throw new BadRequestError('Missing playback source');
      }
      try {
        const vdoPlayback = await getVdoPlaybackInfo(course.playback_source, { user });
        playback = {
          type: 'vdocipher',
          otp: vdoPlayback.otp,
          playbackInfo: vdoPlayback.playbackInfo
        };
      } catch (err) {
        logger.error('VdoCipher playback info acquisition failed', { error: err, playbackSource: course.playback_source });
        throw new AppError('Failed to get playback info', 502, 'VDO_PLAYBACK_INFO_FAILED');
      }
      break;
    }
    case 'hls': {
      if (!course.playback_source) {
        throw new BadRequestError('Missing playback source');
      }
      const supabaseSource = parseSupabaseSource(course.playback_source);
      const manifestUrl = supabaseSource
        ? `${baseUrl}/api/courses/${courseId}/hls/manifest?session_id=${session.id}`
        : course.playback_source;
      playback = {
        type: 'hls',
        manifestUrl,
        expiresAt: expiresAt
      };
      break;
    }
    case 'youtube': {
      if (!course.playback_source) {
        throw new BadRequestError('Missing playback source');
      }
      playback = {
        type: 'youtube',
        url: course.playback_source
      };
      break;
    }
    case 'mp4':
    default: {
      if (!course.playback_source) {
        throw new BadRequestError('Missing playback source');
      }
      playback = {
        type: 'mp4',
        url: course.playback_source
      };
      break;
    }
  }

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
