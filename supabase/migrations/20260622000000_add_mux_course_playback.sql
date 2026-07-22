/*
  # Add Mux as a course playback provider

  Keeps playback_provider as a constrained text field while allowing the backend
  to issue Mux playback descriptors from course_playback_sessions.
*/

ALTER TABLE video_courses
  DROP CONSTRAINT IF EXISTS video_courses_playback_provider_check;

ALTER TABLE video_courses
  ADD CONSTRAINT video_courses_playback_provider_check
  CHECK (playback_provider IN ('vdocipher', 'hls', 'mux', 'youtube', 'mp4'));
