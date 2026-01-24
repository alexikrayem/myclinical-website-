import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Award } from 'lucide-react';
import { coursesApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface Question {
    question: string;
    options: string[];
}

interface QuizModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    quizId: string;
    questions: Question[];
}

const QuizModal: React.FC<QuizModalProps> = ({ isOpen, onClose, courseId, quizId, questions }) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<number[]>(new Array(questions.length).fill(-1));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ passed: boolean; score: number } | null>(null);

    if (!isOpen) return null;

    const handleOptionSelect = (optionIndex: number) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestion] = optionIndex;
        setAnswers(newAnswers);
    };

    const handleNext = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
        }
    };

    const handleSubmit = async () => {
        if (answers.includes(-1)) {
            toast.error('يرجى الإجابة على جميع الأسئلة');
            return;
        }

        setIsSubmitting(true);
        try {
            const data = await coursesApi.submitQuiz(courseId, quizId, answers);
            setResult({ passed: data.passed, score: data.score });
            if (data.passed) {
                toast.success('مبروك! لقد اجتزت الاختبار بنجاح');
            } else {
                toast.error('للأسف، لم تجتز الاختبار. حاول مرة أخرى.');
            }
        } catch (error) {
            toast.error('حدث خطأ أثناء إرسال الإجابات');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (result) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-3xl w-full max-w-md p-8 text-center animate-scaleIn relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>

                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${result.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {result.passed ? <Award size={40} /> : <AlertCircle size={40} />}
                    </div>

                    <h2 className="text-2xl font-bold mb-2">{result.passed ? 'أحسنت!' : 'حاول مرة أخرى'}</h2>
                    <p className="text-gray-600 mb-6">
                        لقد حصلت على <span className="font-bold text-lg">{result.score}%</span> في الاختبار.
                        {result.passed ? ' لقد أتممت الدورة بنجاح.' : ' يجب عليك الحصول على 70% على الأقل للاجتياز.'}
                    </p>

                    <button onClick={onClose} className="btn-primary w-full">
                        إغلاق
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">اختبار الدورة</h2>
                        <p className="text-sm text-gray-500">سؤال {currentQuestion + 1} من {questions.length}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-gray-100 w-full">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                    ></div>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-grow">
                    <h3 className="text-lg font-medium text-gray-900 mb-6 leading-relaxed">
                        {questions[currentQuestion].question}
                    </h3>

                    <div className="space-y-3">
                        {questions[currentQuestion].options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleOptionSelect(index)}
                                className={`w-full text-right p-4 rounded-xl border-2 transition-all ${answers[currentQuestion] === index
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center">
                                    <div className={`w-5 h-5 rounded-full border-2 ml-3 flex items-center justify-center ${answers[currentQuestion] === index ? 'border-blue-500' : 'border-gray-300'
                                        }`}>
                                        {answers[currentQuestion] === index && <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>}
                                    </div>
                                    {option}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-between bg-gray-50">
                    <button
                        onClick={handlePrevious}
                        disabled={currentQuestion === 0}
                        className={`px-6 py-2 rounded-xl font-medium ${currentQuestion === 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        السابق
                    </button>

                    {currentQuestion === questions.length - 1 ? (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || answers.includes(-1)}
                            className="btn-primary px-8"
                        >
                            {isSubmitting ? 'جاري الإرسال...' : 'إرسال الإجابات'}
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="btn-primary px-8"
                        >
                            التالي
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizModal;
