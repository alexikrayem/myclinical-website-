# Example: Secure React Video Player

This component demonstrates the correct way to mount Plyr and HLS.js, handle network recovery, and intercept playback for server-driven attention checks.

```tsx
import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface CoursePlayerProps {
  manifestUrl: string;
  sessionToken: string;
  isAttentionCheckActive: boolean;
  onProgressUpdate: (currentTime: number) => void;
  onFatalError: (msg: string) => void;
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  manifestUrl,
  sessionToken,
  isAttentionCheckActive,
  onProgressUpdate,
  onFatalError
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSyncTime = useRef<number>(0);

  // 1. Core Initialization
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Initialize Plyr UI
    playerRef.current = new Plyr(video, {
      controls:['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
      settings:['quality', 'speed'],
    });

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 30, // Save bandwidth when paused
        xhrSetup: (xhr, url) => {
          // Attach session token to key/segment requests to prevent unauthorized access
          if (url.includes('/api/playback/key') || url.includes('.ts')) {
            xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`);
          }
        }
      });
      hlsRef.current = hls;

      hls.loadSource(manifestUrl);
      hls.attachMedia(video);

      // Error Recovery Strategy
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.warn('Network error, attempting recovery...');
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.warn('Media error, recovering...');
            hls.recoverMediaError();
          } else {
            onFatalError('Unrecoverable stream error.');
            hls.destroy();
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari Native Fallback
      video.src = `${manifestUrl}?token=${sessionToken}`;
    }

    // 2. Throttle Progress Updates (Avoid React Re-renders)
    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      if (currentTime - lastSyncTime.current > 10) { // Sync every 10 seconds
        onProgressUpdate(currentTime);
        lastSyncTime.current = currentTime;
      }
    };
    video.addEventListener('timeupdate', handleTimeUpdate);

    // 3. Strict Cleanup
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  },[manifestUrl, sessionToken, onFatalError, onProgressUpdate]);

  // 4. Force Pause on Attention Check
  useEffect(() => {
    if (isAttentionCheckActive && playerRef.current) {
      playerRef.current.pause();
    }
  }, [isAttentionCheckActive]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-black shadow-2xl border border-slate-800">
      <video ref={videoRef} className="w-full h-full" crossOrigin="anonymous" playsInline />
      
      {/* Attention Check Overlay blocks interaction with the video */}
      {isAttentionCheckActive && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center text-white p-6 bg-slate-900 rounded-lg">
            <h3 className="text-xl font-bold mb-4">Are you still watching?</h3>
            {/* The parent component handles the verified resolution */}
            <p className="text-slate-400">Please verify your presence to continue.</p>
          </div>
        </div>
      )}
    </div>
  );
};