import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import MuxPlayer from '@mux/mux-player-react';
import Plyr from 'plyr';
import { Lock, AlertCircle, Play, Loader2 } from 'lucide-react';
import type { PlaybackDescriptor, MuxTokens } from '../../types/courses';

const HLS_MAX_RETRIES = 3;


interface SecureVideoPlayerProps {
    title: string;
    playback?: PlaybackDescriptor | null;
    hasAccess: boolean;
    billingModel: 'free' | 'per_course' | 'per_minute';
    onPurchase?: () => void;
    creditsRequired?: number;
    onStartPlayback?: () => void;
    isPlaybackLoading?: boolean;
    previewSource?: string | null;
    previewSeconds?: number;
    onPlaybackStateChange?: (isPlaying: boolean) => void;
    onTimeUpdate?: (currentTime: number) => void;
    videoControlRef?: React.MutableRefObject<{ pause: () => void; resume: () => void } | null>;
}

// ---------------------------------------------------------------------------
// MuxVideoPlayer — dedicated sub-component for Mux-hosted assets.
// Uses the official @mux/mux-player-react component which provides:
//  - Adaptive poster / thumbnails (via thumbnail token)
//  - Storyboard timeline hover previews (via storyboard token)
//  - AirPlay / Chromecast, quality selectors
//  - Built-in Mux Data analytics
// ---------------------------------------------------------------------------
interface MuxVideoPlayerProps {
    playbackId: string;
    tokens: MuxTokens | null;
    title: string;
    userId?: string;
    onPlaybackStateChange?: (isPlaying: boolean) => void;
    onTimeUpdate?: (currentTime: number) => void;
    videoControlRef?: React.MutableRefObject<{ pause: () => void; resume: () => void } | null>;
}

const MuxVideoPlayer: React.FC<MuxVideoPlayerProps> = ({
    playbackId,
    tokens,
    title,
    userId,
    onPlaybackStateChange,
    onTimeUpdate,
    videoControlRef,
}) => {
    const muxRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!videoControlRef) return;
        const el = muxRef.current as HTMLVideoElement | null;
        videoControlRef.current = {
            pause: () => el?.pause?.(),
            resume: () => { el?.play?.().catch(() => undefined); },
        };
    }, [videoControlRef]);

    return (
        <MuxPlayer
            ref={muxRef as React.Ref<HTMLElement>}
            playbackId={playbackId}
            tokens={tokens ?? undefined}
            metadata={{
                video_id: playbackId,
                video_title: title,
                viewer_user_id: userId,
            }}
            streamType="on-demand"
            style={{ width: '100%', height: '100%' }}
            onPlay={() => onPlaybackStateChange?.(true)}
            onPause={() => onPlaybackStateChange?.(false)}
            onEnded={() => onPlaybackStateChange?.(false)}
            onTimeUpdate={(e) => {
                const video = e.target as HTMLVideoElement;
                if (video?.currentTime !== undefined) {
                    onTimeUpdate?.(video.currentTime);
                }
            }}
        />
    );
};

// ---------------------------------------------------------------------------
// SecureVideoPlayer — main component
// ---------------------------------------------------------------------------
const SecureVideoPlayer: React.FC<SecureVideoPlayerProps> = ({
    title,
    playback,
    hasAccess,
    billingModel,
    onPurchase,
    creditsRequired,
    onStartPlayback,
    isPlaybackLoading,
    previewSource,
    previewSeconds,
    onPlaybackStateChange,
    onTimeUpdate,
    videoControlRef
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const previewRef = useRef<HTMLVideoElement | null>(null);
    const youtubeRef = useRef<HTMLDivElement | null>(null);
    const plyrInstanceRef = useRef<Plyr | null>(null);
    const [hlsError, setHlsError] = useState(false);

    const extractYouTubeId = (url: string) => {
        try {
            const parsed = new URL(url);
            if (parsed.hostname.includes('youtu.be')) {
                return parsed.pathname.replace('/', '');
            }
            const v = parsed.searchParams.get('v');
            if (v) return v;
            if (parsed.pathname.startsWith('/embed/')) {
                return parsed.pathname.split('/')[2];
            }
        } catch {
            // ignore
        }
        const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{6,})/);
        return match ? match[1] : null;
    };

    // HLS.js is only used for the 'hls' provider (not 'mux' — that uses MuxPlayer)
    const isHlsPlayback = playback?.type === 'hls';

    useEffect(() => {
        if (!previewRef.current || !previewSeconds || previewSeconds <= 0) return;
        const video = previewRef.current;
        const handler = () => {
            if (video.currentTime >= previewSeconds) {
                video.pause();
                video.currentTime = 0;
            }
        };
        video.addEventListener('timeupdate', handler);
        return () => video.removeEventListener('timeupdate', handler);
    }, [previewSeconds, previewSource]);

    useEffect(() => {
        if (!isHlsPlayback) return;
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => onPlaybackStateChange?.(true);
        const handlePause = () => onPlaybackStateChange?.(false);
        const handleEnded = () => onPlaybackStateChange?.(false);
        const handleTimeUpdate = () => onTimeUpdate?.(video.currentTime);

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('timeupdate', handleTimeUpdate);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [isHlsPlayback, onPlaybackStateChange, onTimeUpdate]);

    useEffect(() => {
        if (!playback) return;

        if (playback.type === 'mp4' && videoRef.current) {
            const player = new Plyr(videoRef.current, {
                controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen']
            });
            player.on('play', () => onPlaybackStateChange?.(true));
            player.on('pause', () => onPlaybackStateChange?.(false));
            player.on('ended', () => onPlaybackStateChange?.(false));
            player.on('timeupdate', () => {
                if (player.currentTime !== undefined) onTimeUpdate?.(player.currentTime);
            });
            plyrInstanceRef.current = player;
            return () => {
                player.destroy();
                if (plyrInstanceRef.current === player) {
                    plyrInstanceRef.current = null;
                }
            };
        }

        if (playback.type === 'youtube' && playback.url && youtubeRef.current) {
            const videoId = extractYouTubeId(playback.url);
            if (!videoId) return;
            youtubeRef.current.setAttribute('data-plyr-provider', 'youtube');
            youtubeRef.current.setAttribute('data-plyr-embed-id', videoId);
            const player = new Plyr(youtubeRef.current, {
                controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
                youtube: { noCookie: true }
            });
            player.on('play', () => onPlaybackStateChange?.(true));
            player.on('pause', () => onPlaybackStateChange?.(false));
            player.on('ended', () => onPlaybackStateChange?.(false));
            player.on('timeupdate', () => {
                if (player.currentTime !== undefined) onTimeUpdate?.(player.currentTime);
            });
            plyrInstanceRef.current = player;
            return () => {
                player.destroy();
                if (plyrInstanceRef.current === player) {
                    plyrInstanceRef.current = null;
                }
            };
        }
    }, [playback, onPlaybackStateChange, onTimeUpdate]);

    // Expose pause/resume controls via ref
    useEffect(() => {
        if (!videoControlRef) return;
        // For mux type, MuxVideoPlayer wires the ref itself.
        if (playback?.type === 'mux') return;
        videoControlRef.current = {
            pause: () => {
                if (plyrInstanceRef.current) {
                    plyrInstanceRef.current.pause();
                } else if (videoRef.current) {
                    videoRef.current.pause();
                }
            },
            resume: () => {
                if (plyrInstanceRef.current) {
                    plyrInstanceRef.current.play();
                } else if (videoRef.current) {
                    videoRef.current.play();
                }
            }
        };
    }, [playback, videoControlRef]);

    useEffect(() => {
        if (!playback || !isHlsPlayback || !videoRef.current) return;
        const video = videoRef.current;
        let hls: Hls | null = null;
        // M5: Retry counter — caps recovery attempts to avoid infinite loops from
        // persistent errors (e.g. expired signed URLs).
        let networkRetries = 0;
        let mediaRetried = false;

        setHlsError(false);

        const fatalError = () => {
            hls?.detachMedia();
            hls?.destroy();
            hls = null;
            setHlsError(true);
        };

        if (Hls.isSupported() && playback.manifestUrl) {
            hls = new Hls({
                maxMaxBufferLength: 30,
                startLevel: -1,
                xhrSetup: (xhr) => { xhr.withCredentials = true; }
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (!data.fatal || !hls) return;

                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    if (networkRetries < HLS_MAX_RETRIES) {
                        networkRetries++;
                        hls.startLoad();
                    } else {
                        fatalError();
                    }
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    if (!mediaRetried) {
                        mediaRetried = true;
                        hls.recoverMediaError();
                    } else {
                        fatalError();
                    }
                } else {
                    fatalError();
                }
            });
            hls.loadSource(playback.manifestUrl);
            hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = playback.manifestUrl || '';
        }

        return () => {
            if (hls) {
                hls.detachMedia();
                hls.destroy();
            }
            video.removeAttribute('src');
            video.load();
        };
    }, [playback, isHlsPlayback]);

    if (!playback) {
        return (
            <div className="relative w-full h-full bg-black">
                {previewSource ? (
                    <video
                        ref={previewRef}
                        controls
                        className="w-full h-full"
                        src={previewSource}
                        controlsList="nodownload"
                    >
                        متصفحك لا يدعم تشغيل الفيديو.
                    </video>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                        <AlertCircle size={48} className="text-gray-500 mb-4" />
                        <p className="text-gray-300">ابدأ التشغيل لعرض الفيديو</p>
                    </div>
                )}

                {billingModel === 'per_course' && !hasAccess ? (
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/50 backdrop-blur-sm"
                        data-testid="course-video-locked"
                    >
                        <Lock size={48} className="text-gray-400 mb-4" />
                        <h3 className="text-xl font-bold mb-2">هذا المحتوى مغلق</h3>
                        <p className="text-gray-300 mb-6">يجب شراء الدورة لمشاهدة الفيديو</p>
                        {onPurchase && (
                            <button
                                onClick={onPurchase}
                                className="btn-primary bg-blue-600 hover:bg-blue-700 border-none text-lg px-8 py-3 shadow-lg shadow-blue-900/50"
                                data-testid="course-video-purchase"
                            >
                                شراء الآن ({creditsRequired} رصيد)
                            </button>
                        )}
                    </div>
                ) : hasAccess ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <button
                            onClick={onStartPlayback}
                            className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-gray-900 font-semibold shadow-lg"
                            disabled={isPlaybackLoading}
                        >
                            {isPlaybackLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    جاري التحضير
                                </>
                            ) : (
                                <>
                                    <Play size={18} />
                                    ابدأ المشاهدة
                                </>
                            )}
                        </button>
                    </div>
                ) : null}
            </div>
        );
    }

    if (playback.type === 'vdocipher' && playback.otp && playback.playbackInfo) {
        // C1: Encode OTP and playbackInfo to prevent iframe URL parameter injection
        // if the backend ever returns a value containing '&', '#', or similar chars.
        const iframeSrc = `https://player.vdocipher.com/v2/?otp=${encodeURIComponent(playback.otp)}&playbackInfo=${encodeURIComponent(playback.playbackInfo)}`;
        return (
            <iframe
                src={iframeSrc}
                style={{ border: 0, width: '100%', height: '100%' }}
                allow="encrypted-media"
                allowFullScreen
                title={title}
                data-testid="course-video-iframe"
            ></iframe>
        );
    }

    // Mux: use the official MuxPlayer component (not HLS.js)
    if (playback.type === 'mux' && playback.playbackId) {
        return (
            <MuxVideoPlayer
                playbackId={playback.playbackId}
                tokens={playback.tokens ?? null}
                title={title}
                onPlaybackStateChange={onPlaybackStateChange}
                onTimeUpdate={onTimeUpdate}
                videoControlRef={videoControlRef}
            />
        );
    }

    if (playback.type === 'youtube' && playback.url) {
        const videoId = extractYouTubeId(playback.url);
        // C2: If we cannot extract a valid YouTube ID via the robust parser, render
        // a clean error state instead of constructing an untrusted embed URL via
        // string replacement (which is brittle and can break on non-standard URLs).
        if (!videoId) {
            return (
                <div
                    className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900"
                    data-testid="course-video-error"
                >
                    <AlertCircle size={48} className="text-red-500 mb-4" />
                    <p className="text-gray-300">تعذّر تحميل الفيديو. الرجاء التواصل مع المسؤول.</p>
                </div>
            );
        }
        return <div ref={youtubeRef} className="w-full h-full" data-testid="course-video-youtube"></div>;
    }

    if ((playback.type === 'mp4' && playback.url) || playback.type === 'hls') {
        if (hlsError) {
            return (
                <div
                    className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900"
                    data-testid="course-video-error"
                >
                    <AlertCircle size={48} className="text-red-500 mb-4" />
                    <p className="text-gray-300">حدث خطأ في تحميل الفيديو. الرجاء المحاولة لاحقاً.</p>
                </div>
            );
        }
        return (
            <video
                ref={videoRef}
                src={playback.type === 'mp4' ? playback.url : undefined}
                controls
                className="w-full h-full"
                controlsList="nodownload"
                data-testid="course-video-element"
            >
                متصفحك لا يدعم تشغيل الفيديو.
            </video>
        );
    }

    return (
        <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900"
            data-testid="course-video-error"
        >
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <p className="text-gray-300">حدث خطأ في تحميل الفيديو. الرجاء المحاولة لاحقاً.</p>
        </div>
    );
};

export default SecureVideoPlayer;
