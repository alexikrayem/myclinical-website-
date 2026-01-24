import React, { useState } from 'react';
import { X, CreditCard, CheckCircle, AlertCircle, Gift, Coins, Video, FileText } from 'lucide-react';
import { creditsApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

interface CreditRedeemModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreditRedeemModal: React.FC<CreditRedeemModalProps> = ({ isOpen, onClose }) => {
    const { refreshCredits } = useAuth();
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        message: string;
        credits?: {
            balance: number;
            video_minutes: number;
            article_credits: number;
        };
        credit_type?: string;
    } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;

        setIsLoading(true);
        setResult(null);

        try {
            const data = await creditsApi.redeemCode(code.trim());
            setResult({
                success: true,
                message: data.message || 'تم شحن الرصيد بنجاح!',
                credits: data.credits,
                credit_type: data.credit_type
            });
            toast.success('تم شحن الرصيد بنجاح!');
            await refreshCredits();
            setCode('');
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || 'فشل في استخدام الكود';
            setResult({
                success: false,
                message: errorMessage
            });
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCode = (value: string) => {
        // Convert to uppercase and remove spaces for consistency
        return value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCode(formatCode(e.target.value));
        setResult(null);
    };

    const getCreditTypeLabel = (type?: string) => {
        switch (type) {
            case 'video': return 'دقائق مشاهدة';
            case 'article': return 'مقالات';
            case 'both': return 'مشاهدة + مقالات';
            default: return 'رصيد عام';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                    <button
                        onClick={onClose}
                        className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Gift size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">شحن رصيد</h2>
                            <p className="text-white/80 text-sm">أدخل كود البطاقة</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Code Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                كود البطاقة
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={code}
                                    onChange={handleCodeChange}
                                    placeholder="XXXX-XXXX-XXXX"
                                    className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider"
                                    dir="ltr"
                                    maxLength={20}
                                    autoFocus
                                />
                                <CreditCard size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>

                        {/* Result Message */}
                        {result && (
                            <div className={`p-4 rounded-xl flex items-start gap-3 ${result.success
                                    ? 'bg-green-50 border border-green-200 text-green-700'
                                    : 'bg-red-50 border border-red-200 text-red-700'
                                }`}>
                                {result.success ? (
                                    <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className="font-medium">{result.message}</p>
                                    {result.success && result.credits && (
                                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                            <div className="p-2 bg-white/50 rounded-lg">
                                                <Coins size={16} className="mx-auto text-yellow-600 mb-1" />
                                                <div className="text-sm font-bold">{result.credits.balance}</div>
                                                <div className="text-xs opacity-70">عام</div>
                                            </div>
                                            <div className="p-2 bg-white/50 rounded-lg">
                                                <Video size={16} className="mx-auto text-blue-600 mb-1" />
                                                <div className="text-sm font-bold">{result.credits.video_minutes}</div>
                                                <div className="text-xs opacity-70">دقيقة</div>
                                            </div>
                                            <div className="p-2 bg-white/50 rounded-lg">
                                                <FileText size={16} className="mx-auto text-green-600 mb-1" />
                                                <div className="text-sm font-bold">{result.credits.article_credits}</div>
                                                <div className="text-xs opacity-70">مقال</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !code.trim()}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium py-3 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <CreditCard size={20} />
                                    شحن الآن
                                </>
                            )}
                        </button>
                    </form>

                    {/* Help Text */}
                    <p className="text-center text-sm text-gray-500 mt-4">
                        الكود موجود على ظهر بطاقة الشحن
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CreditRedeemModal;
