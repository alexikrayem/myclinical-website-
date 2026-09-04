import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Timer } from 'lucide-react';
import type { Challenge } from '../../types/courses';

interface AttentionCheckModalProps {
    challenge: Challenge;
    onResult: (result: { passed: boolean; session_terminated: boolean; failures: number; max_failures: number }) => void;
    onVerify: (challengeId: string, answer: string) => Promise<{ passed: boolean; session_terminated: boolean; failures: number; max_failures: number; attention_score?: number }>;
    onExpire: (challengeId: string) => Promise<{ passed: boolean; session_terminated: boolean; failures: number; max_failures: number; attention_score?: number }>;
}

const AttentionCheckModal: React.FC<AttentionCheckModalProps> = ({
    challenge,
    onResult,
    onVerify,
    onExpire
}) => {
    const [timeLeft, setTimeLeft] = useState(challenge.timeout_seconds);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [mathAnswer, setMathAnswer] = useState('');

    // Countdown timer
    useEffect(() => {
        if (feedback) return; // Stop countdown after response

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [feedback]);

    const handleTimeout = useCallback(async () => {
        setIsSubmitting(true);
        try {
            const result = await onExpire(challenge.id);
            setFeedback('wrong');
            setTimeout(() => onResult(result), 1500);
        } catch {
            // If expire fails, still close the modal
            onResult({ passed: false, session_terminated: false, failures: 0, max_failures: 3 });
        }
    }, [challenge.id, onExpire, onResult]);

    useEffect(() => {
        if (timeLeft === 0 && !feedback && !isSubmitting) {
            handleTimeout();
        }
    }, [timeLeft, feedback, isSubmitting, handleTimeout]);

    const handleAnswer = useCallback(async (answer: string) => {
        if (isSubmitting || feedback) return;
        setIsSubmitting(true);
        try {
            const result = await onVerify(challenge.id, answer);
            setFeedback(result.passed ? 'correct' : 'wrong');
            setTimeout(() => onResult(result), 1200);
        } catch {
            onResult({ passed: false, session_terminated: false, failures: 0, max_failures: 3 });
        }
    }, [challenge.id, isSubmitting, feedback, onVerify, onResult]);

    const progressPercent = (timeLeft / challenge.timeout_seconds) * 100;
    const isUrgent = timeLeft <= 5;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="attention-check-modal">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-scaleIn shadow-2xl">
                {/* Timer Bar */}
                <div className="h-1.5 bg-gray-100 w-full">
                    <div
                        className={`h-full transition-all duration-1000 ease-linear rounded-full ${isUrgent ? 'bg-red-500' : 'bg-blue-500'
                            }`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* Header */}
                <div className="px-6 pt-6 pb-3 text-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${feedback === 'correct'
                        ? 'bg-green-100'
                        : feedback === 'wrong'
                            ? 'bg-red-100'
                            : isUrgent
                                ? 'bg-red-100 animate-pulse'
                                : 'bg-blue-100'
                        }`}>
                        {feedback === 'correct' ? (
                            <CheckCircle className="text-green-600" size={28} />
                        ) : feedback === 'wrong' ? (
                            <XCircle className="text-red-600" size={28} />
                        ) : (
                            <ShieldAlert className={`${isUrgent ? 'text-red-600' : 'text-blue-600'}`} size={28} />
                        )}
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {feedback === 'correct'
                            ? 'أحسنت! ✓'
                            : feedback === 'wrong'
                                ? 'إجابة خاطئة ✗'
                                : 'التحقق من الانتباه'}
                    </h3>

                    {!feedback && (
                        <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500">
                            <Timer size={14} />
                            <span className={isUrgent ? 'text-red-600 font-bold' : ''}>
                                {timeLeft} ثانية
                            </span>
                        </div>
                    )}
                </div>

                {/* Challenge Content */}
                <div className="px-6 pb-6">
                    {!feedback && (
                        <>
                            <p className="text-center text-gray-700 font-medium mb-5 text-base">
                                {challenge.data.question}
                            </p>

                            {/* Color Pick Challenge */}
                            {challenge.type === 'color' && challenge.data.options && (
                                <div className="grid grid-cols-2 gap-3">
                                    {challenge.data.options.map((color) => (
                                        <button
                                            key={color.id}
                                            onClick={() => handleAnswer(color.id)}
                                            disabled={isSubmitting}
                                            className="group relative h-20 rounded-2xl border-3 border-gray-200 hover:border-gray-400 transition-all duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                                            data-testid={`color-option-${color.id}`}
                                            style={{ backgroundColor: color.hex }}
                                        >
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-2xl" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Math Challenge */}
                            {challenge.type === 'math' && (
                                <div className="space-y-3">
                                    <input
                                        type="number"
                                        value={mathAnswer}
                                        onChange={e => setMathAnswer(e.target.value)}
                                        placeholder="أدخل الإجابة"
                                        className="w-full px-4 py-3 text-center text-xl font-bold rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                        autoFocus
                                        data-testid="math-answer-input"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && mathAnswer) {
                                                handleAnswer(mathAnswer);
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => handleAnswer(mathAnswer)}
                                        disabled={!mathAnswer || isSubmitting}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        data-testid="math-submit-btn"
                                    >
                                        تأكيد
                                    </button>
                                </div>
                            )}

                        </>
                    )}

                    {/* Feedback Messages */}
                    {feedback === 'correct' && (
                        <p className="text-center text-green-600 font-medium animate-fadeIn">
                            سيتم استئناف التشغيل...
                        </p>
                    )}

                    {feedback === 'wrong' && (
                        <p className="text-center text-red-600 font-medium animate-fadeIn">
                            {timeLeft === 0 ? 'انتهى الوقت!' : 'حاول أن تركز أكثر.'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttentionCheckModal;
