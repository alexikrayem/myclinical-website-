import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, User, Calendar, Award, Coins } from 'lucide-react';
import { coursesApi } from '../lib/api';
import { formatDistance } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';
import QuizModal from '../components/courses/QuizModal';
import SecureVideoPlayer from '../components/courses/SecureVideoPlayer';

const CourseDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const [course, setCourse] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [quiz, setQuiz] = useState<any>(null);
    const [showQuiz, setShowQuiz] = useState(false);

    useEffect(() => {
        const fetchCourse = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const data = await coursesApi.getById(id);
                setCourse(data);

                // Use the secure flag from backend
                if (data.has_access) {
                    setHasAccess(true);
                    // Only fetch quiz if we have access
                    try {
                        const quizData = await coursesApi.getQuiz(id);
                        if (quizData) setQuiz(quizData);
                    } catch (e) {
                        console.log('Quiz not available yet');
                    }
                } else {
                    setHasAccess(false);
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
            // Refresh quiz to get data
            const quizData = await coursesApi.getQuiz(id);
            setQuiz(quizData);
        } catch (error: any) {
            if (error.response?.status === 400) {
                toast.error(error.response.data.error || 'رصيد غير كافي');
            } else {
                toast.error('فشل عملية الشراء. تأكد من تسجيل الدخول.');
            }
        }
    };

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
                                    vdo_playback={course.vdo_playback}
                                    hasAccess={hasAccess}
                                    onPurchase={handlePurchase}
                                    creditsRequired={course.credits_required}
                                    videoUrl={course.video_url}
                                />
                            </div>

                            <div>
                                <h1 className="text-3xl font-bold mb-4 leading-tight">{course.title}</h1>
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
                                    <span className="text-gray-400">سعر الدورة</span>
                                    <div className="flex items-center text-xl font-bold text-yellow-400">
                                        <Coins size={20} className="ml-2" />
                                        {course.credits_required} رصيد
                                    </div>
                                </div>

                                {!hasAccess ? (
                                    <button
                                        onClick={handlePurchase}
                                        className="w-full btn-primary bg-blue-600 hover:bg-blue-700 border-none py-3 mb-4"
                                    >
                                        شراء الوصول
                                    </button>
                                ) : (
                                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-center py-3 rounded-xl mb-4 font-medium">
                                        تمتلك صلاحية الوصول
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
                                    <button
                                        onClick={() => setShowQuiz(true)}
                                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors font-medium"
                                    >
                                        بدء الاختبار
                                    </button>
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
                            {course.categories.map((cat: string, i: number) => (
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
        </div>
    );
};

export default CourseDetailPage;
