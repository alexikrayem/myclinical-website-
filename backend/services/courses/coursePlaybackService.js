import { getVdoPlaybackInfo } from '../vdoService.js';
import { parseSupabaseSource } from './hlsService.js';

const PLAYBACK_SESSION_TTL_SECONDS = parseInt(process.env.PLAYBACK_SESSION_TTL_SECONDS || '600', 10);

const buildSessionExpiry = () => new Date(Date.now() + PLAYBACK_SESSION_TTL_SECONDS * 1000).toISOString();

export async function createPlaybackSession({ supabase, courseId, user, baseUrl }) {
  const { data: course, error } = await supabase
    .from('video_courses')
    .select('id, title, playback_source, playback_provider, billing_model, minute_cost, credits_required')
    .eq('id', courseId)
    .single();

  if (error || !course) {
    return { error: 'Course not found', status: 404 };
  }

  if (course.billing_model === 'per_course') {
    const { data: access } = await supabase
      .from('course_access')
      .select('id')
      .eq('custom_user_id', user.id)
      .eq('course_id', courseId)
      .single();

    if (!access) {
      return { error: 'Course access required', status: 403 };
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
      return { error: 'رصيد غير كافي', status: 400 };
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
    return { error: 'Failed to create playback session', status: 500 };
  }

  let playback = null;

  switch (course.playback_provider) {
    case 'vdocipher': {
      if (!course.playback_source) {
        return { error: 'Missing playback source', status: 400 };
      }
      try {
        const vdoPlayback = await getVdoPlaybackInfo(course.playback_source, { user });
        playback = {
          type: 'vdocipher',
          otp: vdoPlayback.otp,
          playbackInfo: vdoPlayback.playbackInfo
        };
      } catch (err) {
        return { error: 'Failed to get playback info', status: 502 };
      }
      break;
    }
    case 'hls': {
      if (!course.playback_source) {
        return { error: 'Missing playback source', status: 400 };
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
        return { error: 'Missing playback source', status: 400 };
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
        return { error: 'Missing playback source', status: 400 };
      }
      playback = {
        type: 'mp4',
        url: course.playback_source
      };
      break;
    }
  }

  return {
    session_id: session.id,
    expires_at: expiresAt,
    playback,
    billing_model: course.billing_model,
    minute_cost: course.minute_cost,
    credits: creditsSummary
  };
}
