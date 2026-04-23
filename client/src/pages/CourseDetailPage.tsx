import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, User, Calendar, Award, Coins, Tag, ShieldCheck } from 'lucide-react';
import { coursesApi, creditsApi } from '../lib/api';
import { formatDistance } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';
import QuizModal from '../components/courses/QuizModal';
import SecureVideoPlayer from '../components/courses/SecureVideoPlayer';
import AttentionCheckModal from '../components/courses/AttentionCheckModal';
import axios from 'axios';

interface QuizData {
    id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    questions: any[];
}

export interface Challenge {
    id: string;
    type: "color" | "math" | "confirm";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    trigger_at_seconds: number;
    timeout_seconds: number;
}

type BillingModel = 'free' | 'per_course' | 'per_minute';

type PlaybackDescriptor =
    | { type: 'vdocipher'; otp: string; playbackInfo: string }
    | { type: 'hls'; manifestUrl: string; expiresAt?: string }
    | { type: 'youtube'; url: string }
    | { type: 'mp4'; url: string };

interface TypedCredit {
    credit_type_id: string;
    name: string;
    prefix: string;
    balance: number;
}

interface Course {
    id: string;
    title: string;
    description: string;
    cover_image: string;
    publication_date: string;
    author: string;
    categories: string[];
    credits_required: number;
    duration: number;
    billing_model: BillingModel;
    minute_cost: number;
    playback_provider: string;
    preview_source?: string | null;
    preview_seconds?: number;
    has_access?: boolean;
    requires_auth?: boolean;
    applicable_typed_credits?: TypedCredit[];
    attention_required?: boolean;
}

const CourseDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const [course, setCourse] = useState<Course | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [showQuiz, setShowQuiz] = useState(false);
    const [playback, setPlayback] = useState<PlaybackDescriptor | null>(null);
    const [playbackSessionId, setPlaybackSessionId] = useState<string | null>(null);
    const [playbackLoading, setPlaybackLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [credits, setCredits] = useState<{ remaining_minutes?: number; remaining_balance?: number } | null>(null);
    const [autoPlaybackRequested, setAutoPlaybackRequested] = useState(false);
    const isLoggedIn = Boolean(localStorage.getItem('user_token'));

    // Attention verification state
    const [attentionRequired, setAttentionRequired] = useState(false);
    const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
    const [attentionScore, setAttentionScore] = useState<number | null>(null);
    const [sessionTerminated, setSessionTerminated] = useState(false);
    const [currentVideoTime, setCurrentVideoTime] = useState(0);
    const videoControlRef = useRef<{ pause: () => void; resume: () => void } | null>(null);

    useEffect(() => {
        const fetchCourse = async () => {
            if (!id) return;
            setIsLoading(true);
            setPlayback(null);
            setPlaybackSessionId(null);
            setIsPlaying(false);
            setCredits(null);
            setQuiz(null);
            setShowQuiz(false);
            setHasAccess(false);
            setPlaybackLoading(false);
            setAutoPlaybackRequested(false);
            try {
                const data = await coursesApi.getById(id);
                setCourse(data);

                if (data.has_access) {
                    setHasAccess(true);
                } else {
                    setHasAccess(false);
                }

                if (data.billing_model === 'per_course' && data.has_access) {
                    try {
                        const quizData = await coursesApi.getQuiz(id);
                        if (quizData) setQuiz(quizData);
                    } catch {
                        console.log('Quiz not available yet');
                    }
                }

                if (data.billing_model === 'per_minute' && localStorage.getItem('user_token')) {
                    try {
                        const creditData = await creditsApi.getBalance();
                        setCredits({
                            remaining_minutes: creditData.video_watch_minutes,
                            remaining_balance: creditData.balance
                        });
                    } catch {
                        // ignore
                    }
                }

            } catch (error) {
                console.error('Failed to fetch course', error);
                toast.error('فشل تحميل الدورة');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCourse();
    }, [id]);

    const handlePurchase = async () => {
        if (!id) return;
        try {
            await coursesApi.purchaseAccess(id);
            toast.success('تم شراء الدورة بنجاح!');
            setHasAccess(true);
            try {
                const quizData = await coursesApi.getQuiz(id);
                setQuiz(quizData);
            } catch {
                // Quiz might not be available yet
            }
        } catch (error: unknown) {
            const err = error as { response?: { status?: number; data?: { error?: string } } };
            if (err.response?.status === 400) {
                toast.error(err.response.data?.error || 'رصيد غير كافي');
            } else {
                toast.error('فشل عملية الشراء. تأكد من تسجيل الدخول.');
            }
        }
    };

    const startPlayback = useCallback(async () => {
        if (!id) return;
        if (playbackLoading || playback) return;
        if (!localStorage.getItem('user_token')) {
            toast.error('يرجى تسجيل الدخول لبدء التشغيل');
            return;
        }
        setPlaybackLoading(true);
        try {
            const result = await coursesApi.getPlayback(id);
            setPlayback(result.playback);
            setPlaybackSessionId(result.session_id);
            if (result.credits) {
                setCredits(result.credits);
            }
            // Set attention tracking
            if (result.attention_required) {
                setAttentionRequired(true);
            }
            setSessionTerminated(false);
            setAttentionScore(null);
        } catch (error: unknown) {
            const message = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
            toast.error(message || 'تعذر بدء التشغيل');
        } finally {
            setPlaybackLoading(false);
        }
    }, [id, playbackLoading, playback]);

    useEffect(() => {
        if (!course || !id || autoPlaybackRequested || playback || playbackLoading) return;
        if (!isLoggedIn) return;
        if (course.billing_model === 'per_course' && !hasAccess) return;
        setAutoPlaybackRequested(true);
        startPlayback();
    }, [course, id, autoPlaybackRequested, playback, playbackLoading, isLoggedIn, hasAccess, startPlayback]);

    useEffect(() => {
        if (!id || !playbackSessionId || !isPlaying || course?.billing_model !== 'per_minute') return;
        const interval = setInterval(async () => {
            try {
                const idempotencyKey = typeof crypto?.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const result = await coursesApi.sendHeartbeat(id, {
                    session_id: playbackSessionId,
                    seconds_delta: 30,
                    idempotency_key: idempotencyKey
                });

                if (result?.remaining_minutes !== undefined || result?.remaining_balance !== undefined) {
                    setCredits({
                        remaining_minutes: result.remaining_minutes,
                        remaining_balance: result.remaining_balance
                    });
                }
            } catch (error: unknown) {
                const message = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
                toast.error(message || 'رصيد غير كافي');
                setIsPlaying(false);
                setPlayback(null);
                setPlaybackSessionId(null);
                setAutoPlaybackRequested(true);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [id, playbackSessionId, isPlaying, course?.billing_model]);

    // Attention check polling — every 10 seconds while playing
    useEffect(() => {
        if (!id || !playbackSessionId || !isPlaying || !attentionRequired || sessionTerminated) return;
        if (currentChallenge) return; // Don't poll while a challenge is active

        const interval = setInterval(async () => {
            try {
                const result = await coursesApi.getAttentionCheck(id, playbackSessionId, currentVideoTime);
                if (result?.challenge) {
                    // Pause the video and show the challenge
                    videoControlRef.current?.pause();
                    setCurrentChallenge(result.challenge);
                }
            } catch {
                // Non-fatal: silently continue
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [id, playbackSessionId, isPlaying, attentionRequired, sessionTerminated, currentChallenge, currentVideoTime]);

    // Attention check handlers
    const handleAttentionVerify = useCallback(async (challengeId: string, answer: string) => {
        if (!id || !playbackSessionId) throw new Error('Missing session');
        return await coursesApi.verifyAttentionCheck(id, {
            session_id: playbackSessionId,
            challenge_id: challengeId,
            answer
        });
    }, [id, playbackSessionId]);

    const handleAttentionExpire = useCallback(async (challengeId: string) => {
        if (!id || !playbackSessionId) throw new Error('Missing session');
        return await coursesApi.verifyAttentionCheck(id, {
            session_id: playbackSessionId,
            challenge_id: challengeId,
            expired: true
        });
    }, [id, playbackSessionId]);

    const handleAttentionResult = useCallback((result: { passed: boolean; session_terminated: boolean; attention_score?: number; failures: number; max_failures: number }) => {
        setCurrentChallenge(null);

        if (result.attention_score !== undefined) {
            setAttentionScore(result.attention_score);
        }

        if (result.session_terminated) {
            setSessionTerminated(true);
            setPlayback(null);
            setPlaybackSessionId(null);
            setIsPlaying(false);
            setAutoPlaybackRequested(false);
            toast.error(`تم إنهاء الجلسة بسبب عدم الانتباه (${result.failures}/${result.max_failures} محاولات فاشلة). يرجى إعادة بدء المشاهدة.`);
            return;
        }

        if (!result.passed) {
            toast(`تنبيه: ${result.failures}/${result.max_failures} محاولات فاشلة`, { icon: '⚠️' });
        }

        // Resume video
        videoControlRef.current?.resume();
    }, []);

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-12 flex justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!course) return <div className="text-center py-12">الدورة غير موجودة</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Hero Section with Video/Cover */}
            <div className="bg-gray-900 text-white">
                <div className="container mx-auto px-4 py-8 lg:py-12">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        {/* Video Player Area */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
                                <SecureVideoPlayer
                                    title={course.title}
                                    playback={playback}
                                    hasAccess={hasAccess}
                                    billingModel={course.billing_model}
                                    onPurchase={isLoggedIn ? handlePurchase : undefined}
                                    creditsRequired={course.credits_required}
                                    onStartPlayback={startPlayback}
                                    isPlaybackLoading={playbackLoading}
                                    previewSource={course.preview_source}
                                    previewSeconds={course.preview_seconds}
                                    onPlaybackStateChange={setIsPlaying}
                                    onTimeUpdate={setCurrentVideoTime}
                                    videoControlRef={videoControlRef}
                                />
                            </div>

                            <div>
                                <h1
                                    className="text-3xl font-bold mb-4 leading-tight"
                                    data-testid="course-detail-title"
                                >
                                    {course.title}
                                </h1>
                                <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                                    <div className="flex items-center">
                                        <User size={16} className="ml-1 text-blue-400" />
                                        {course.author}
                                    </div>
                                    <div className="flex items-center">
                                        <Calendar size={16} className="ml-1 text-blue-400" />
                                        {formatDistance(new Date(course.publication_date), new Date(), { addSuffix: true, locale: ar })}
                                    </div>
                                    <div className="flex items-center">
                                        <Clock size={16} className="ml-1 text-blue-400" />
                                        {Math.floor(course.duration / 60)} دقيقة
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="text-gray-400">نموذج الفوترة</span>
                                    <div className="flex items-center text-xl font-bold text-yellow-400">
                                        <Coins size={20} className="ml-2" />
                                        {course.billing_model === 'per_minute'
                                            ? `${course.minute_cost} رصيد/دقيقة`
                                            : course.billing_model === 'free'
                                                ? 'مجاني'
                                                : `${course.credits_required} رصيد`}
                                    </div>
                                </div>

                                {course.billing_model === 'per_course' && !hasAccess ? (
                                    isLoggedIn ? (
                                        <>
                                            {course.applicable_typed_credits && course.applicable_typed_credits.length > 0 && (
                                                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl mb-4 text-sm flex items-start gap-2">
                                                    <Tag size={18} className="shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="font-bold block mb-1">رصيد مخصص متاح</span>
                                                        سيتم خصم التكلفة من رصيد {course.applicable_typed_credits[0].name} ({course.applicable_typed_credits[0].balance} رصيد متوفر).
                                                    </div>
                                                </div>
                                            )}
                                            <button
                                                onClick={handlePurchase}
                                                className="w-full btn-primary bg-blue-600 hover:bg-blue-700 border-none py-3 mb-4"
                                                data-testid="course-purchase-button"
                                            >
                                                شراء الوصول
                                            </button>
                                        </>
                                    ) : (
                                        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-center py-3 rounded-xl mb-4 font-medium">
                                            يرجى تسجيل الدخول لشراء الوصول
                                        </div>
                                    )
                                ) : !hasAccess ? (
                                    <div
                                        className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-center py-3 rounded-xl mb-4 font-medium"
                                    >
                                        يرجى تسجيل الدخول لبدء التشغيل
                                    </div>
                                ) : (
                                    <div
                                        className="bg-green-500/10 border border-green-500/20 text-green-400 text-center py-3 rounded-xl mb-4 font-medium"
                                        data-testid="course-access-granted"
                                    >
                                        {course.billing_model === 'per_minute' ? 'جاهز للتشغيل' : 'تمتلك صلاحية الوصول'}
                                    </div>
                                )}

                                {course.billing_model === 'per_minute' && credits && (
                                    <div className="space-y-2 text-sm text-gray-300">
                                        <div className="flex items-center justify-between py-2 border-b border-gray-700">
                                            <span>رصيد الدقائق</span>
                                            <span>{credits.remaining_minutes ?? 0}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2 border-b border-gray-700">
                                            <span>الرصيد العام</span>
                                            <span>{credits.remaining_balance ?? 0}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3 text-sm text-gray-300">
                                    <div className="flex items-center justify-between py-2 border-b border-gray-700">
                                        <span>المدة</span>
                                        <span>{Math.floor(course.duration / 60)} دقيقة</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b border-gray-700">
                                        <span>المستوى</span>
                                        <span>متوسط</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b border-gray-700">
                                        <span>الشهادة</span>
                                        <span>نعم</span>
                                    </div>
                                </div>
                            </div>

                            {hasAccess && quiz && (
                                <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 backdrop-blur rounded-2xl p-6 border border-purple-500/30">
                                    <h3 className="font-bold text-lg mb-2 flex items-center">
                                        <Award className="ml-2 text-purple-400" />
                                        اختبار الدورة
                                    </h3>
                                    <p className="text-sm text-gray-300 mb-4">
                                        أكمل مشاهدة الفيديو ثم اختبر معلوماتك للحصول على الشهادة.
                                    </p>
                                    {attentionRequired && attentionScore !== null && attentionScore < 80 ? (
                                        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                            <ShieldCheck size={16} className="inline ml-1" />
                                            يجب تحقيق نسبة انتباه 80% على الأقل للوصول للاختبار. نسبتك الحالية: {attentionScore}%
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowQuiz(true)}
                                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors font-medium"
                                        >
                                            بدء الاختبار
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Attention Score Badge */}
                            {attentionRequired && playbackSessionId && attentionScore !== null && (
                                <div className={`rounded-2xl p-4 border text-center ${attentionScore >= 80
                                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    }`}>
                                    <ShieldCheck size={20} className="inline ml-1" />
                                    <span className="font-bold text-lg">{attentionScore}%</span>
                                    <span className="block text-sm opacity-75 mt-1">نسبة الانتباه</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs/Description */}
            <div className="container mx-auto px-4 py-8">
                <div className="bg-white rounded-3xl p-8 card-shadow max-w-4xl">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">عن الدورة</h2>
                    <div className="prose max-w-none text-gray-600 leading-relaxed">
                        <p>{course.description}</p>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-4">التصنيفات</h3>
                        <div className="flex flex-wrap gap-2">
                            {course.categories.map((cat, i) => (
                                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                                    {cat}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {quiz && (
                <QuizModal
                    isOpen={showQuiz}
                    onClose={() => setShowQuiz(false)}
                    courseId={course.id}
                    quizId={quiz.id}
                    questions={quiz.questions}
                />
            )}

            {/* Attention Check Modal */}
            {currentChallenge && (
                <AttentionCheckModal
                    challenge={currentChallenge}
                    onResult={handleAttentionResult}
                    onVerify={handleAttentionVerify}
                    onExpire={handleAttentionExpire}
                />
            )}
        </div>
    );
};

export default CourseDetailPage;
