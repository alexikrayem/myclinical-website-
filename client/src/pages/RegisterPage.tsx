import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, UserPlus, AlertCircle, User, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { register, isLoading } = useAuth();

    const [phoneNumber, setPhoneNumber] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const from = (location.state as any)?.from?.pathname || '/';

    // Password validation
    const hasMinLength = password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const passwordsMatch = password === confirmPassword && password.length > 0;
    const isPasswordValid = hasMinLength && hasLetter && hasNumber;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!isPasswordValid) {
            setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم');
            return;
        }

        if (!passwordsMatch) {
            setError('كلمتا المرور غير متطابقتين');
            return;
        }

        setIsSubmitting(true);

        try {
            await register(phoneNumber, password, displayName || undefined);
            toast.success('تم إنشاء الحساب بنجاح!');
            navigate(from, { replace: true });
        } catch (err: any) {
            setError(err.message || 'فشل إنشاء الحساب');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatPhoneNumber = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 10);
        setPhoneNumber(digits);
    };

    const PasswordRequirement = ({ met, text }: { met: boolean; text: string }) => (
        <div className={`flex items-center gap-2 text-sm ${met ? 'text-green-600' : 'text-gray-400'}`}>
            <CheckCircle size={14} className={met ? 'opacity-100' : 'opacity-30'} />
            <span>{text}</span>
        </div>
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block mb-6">
                        <img src="/logo.png" alt="Logo" className="h-20 mx-auto" />
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">إنشاء حساب جديد</h1>
                    <p className="text-gray-600">انضم إلينا للوصول إلى المحتوى التعليمي</p>
                </div>

                {/* Register Form */}
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error Alert */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-fadeIn">
                                <AlertCircle size={20} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Display Name Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                الاسم (اختياري)
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="اسمك الكريم"
                                    className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                                <User size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>

                        {/* Phone Number Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                رقم الهاتف <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    value={phoneNumber}
                                    onChange={(e) => formatPhoneNumber(e.target.value)}
                                    placeholder="09xxxxxxxx"
                                    className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-left"
                                    dir="ltr"
                                    required
                                />
                                <Phone size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                كلمة المرور <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 pr-12 pl-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    required
                                />
                                <Lock size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>

                            {/* Password Requirements */}
                            {password.length > 0 && (
                                <div className="mt-2 space-y-1 bg-gray-50 p-3 rounded-lg">
                                    <PasswordRequirement met={hasMinLength} text="8 أحرف على الأقل" />
                                    <PasswordRequirement met={hasLetter} text="حرف واحد على الأقل" />
                                    <PasswordRequirement met={hasNumber} text="رقم واحد على الأقل" />
                                </div>
                            )}
                        </div>

                        {/* Confirm Password Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                تأكيد كلمة المرور <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={`w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${confirmPassword.length > 0 && !passwordsMatch
                                            ? 'border-red-300 bg-red-50'
                                            : confirmPassword.length > 0 && passwordsMatch
                                                ? 'border-green-300 bg-green-50'
                                                : 'border-gray-200'
                                        }`}
                                    required
                                />
                                <Lock size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                {confirmPassword.length > 0 && (
                                    <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${passwordsMatch ? 'text-green-500' : 'text-red-500'
                                        }`}>
                                        {passwordsMatch ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting || isLoading || !isPasswordValid || !passwordsMatch}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium py-3 px-6 rounded-xl hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <UserPlus size={20} />
                                    إنشاء الحساب
                                </>
                            )}
                        </button>
                    </form>

                    {/* Login Link */}
                    <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                        <p className="text-gray-600">
                            لديك حساب بالفعل؟{' '}
                            <Link
                                to="/login"
                                state={{ from: location.state?.from }}
                                className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                                تسجيل الدخول
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Back to Home */}
                <div className="text-center mt-6">
                    <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">
                        العودة للصفحة الرئيسية
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
