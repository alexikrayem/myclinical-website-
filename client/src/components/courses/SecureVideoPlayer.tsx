import React from 'react';
import { Lock, AlertCircle } from 'lucide-react';

interface SecureVideoPlayerProps {
    title: string;
    vdo_playback?: {
        otp: string;
        playbackInfo: string;
    };
    hasAccess: boolean;
    onPurchase: () => void;
    creditsRequired: number;
    videoUrl?: string; // Fallback to normal URL if not secure
}

const SecureVideoPlayer: React.FC<SecureVideoPlayerProps> = ({
    title,
    vdo_playback,
    hasAccess,
    onPurchase,
    creditsRequired,
    videoUrl
}) => {
    if (!hasAccess) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/50 backdrop-blur-sm">
                <Lock size={48} className="text-gray-400 mb-4" />
                <h3 className="text-xl font-bold mb-2">هذا المحتوى مغلق</h3>
                <p className="text-gray-300 mb-6">يجب شراء الدورة لمشاهدة الفيديو</p>
                <button
                    onClick={onPurchase}
                    className="btn-primary bg-blue-600 hover:bg-blue-700 border-none text-lg px-8 py-3 shadow-lg shadow-blue-900/50"
                >
                    شراء الآن ({creditsRequired} رصيد)
                </button>
            </div>
        );
    }

    // If we have VdoCipher playback info
    if (vdo_playback?.otp && vdo_playback?.playbackInfo) {

        // Check for Mock Mode
        if (vdo_playback.otp.startsWith('mock-otp') || (vdo_playback as any).isMock) {
            return (
                <div className="relative w-full h-full bg-black">
                    <video
                        controls
                        className="w-full h-full"
                        src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                        poster="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg"
                    >
                        Your browser does not support the video tag.
                    </video>
                    <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded font-bold opacity-75">
                        وضع التجربة (Mock Mode)
                    </div>
                </div>
            );
        }

        const iframeSrc = `https://player.vdocipher.com/v2/?otp=${vdo_playback.otp}&playbackInfo=${vdo_playback.playbackInfo}`;

        return (
            <iframe
                src={iframeSrc}
                style={{ border: 0, width: '100%', height: '100%' }}
                allow="encrypted-media"
                allowFullScreen
                title={title}
            ></iframe>
        );
    }

    // Fallback for normal video URLs (YT, etc.)
    if (videoUrl) {
        const isYoutube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');

        if (isYoutube) {
            const embedUrl = videoUrl.replace('watch?v=', 'embed/');
            return (
                <iframe
                    src={`${embedUrl}?modestbranding=1&rel=0&showinfo=0&iv_load_policy=3`}
                    className="w-full h-full"
                    title={title}
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                ></iframe>
            );
        }

        return (
            <video
                src={videoUrl}
                controls
                className="w-full h-full"
                controlsList="nodownload"
            >
                متصفحك لا يدعم تشغيل الفيديو.
            </video>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <p className="text-gray-300">حدث خطأ في تحميل الفيديو. الرجاء المحاولة لاحقاً.</p>
        </div>
    );
};

export default SecureVideoPlayer;
