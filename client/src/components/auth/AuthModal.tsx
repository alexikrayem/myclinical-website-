import React, { useState } from 'react';
import { X, CheckCircle, Mail, Lock, User, Phone, ArrowRight, BookOpen, GraduationCap, Video } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
    const [mode, setMode] = useState<'login' | 'register'>(initialMode);
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                if (password !== confirmPassword) {
                    throw new Error('كلمة المرور غير متطابقة');
                }
                await register(name, email, password, phone);
            }
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'حدث خطأ ما');
        } finally {
            setLoading(false);
        }
    };

    const benefits = [
        { icon: BookOpen, text: 'الوصول لأكثر من 500 ورقة بحثية' },
        { icon: Video, text: 'مشاهدة دورات تدريبية حصرية' },
        { icon: GraduationCap, text: 'شهادات معتمدة وتطوير مهني' },
        { icon: CheckCircle, text: 'نشرة بريدية أسبوعية بأحدث التطورات' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col md:flex-row relative animate-scaleIn">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full text-white md:text-gray-500 md:bg-gray-100 md:hover:bg-gray-200 transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Left Side: Benefits (Hidden on mobile sometimes, but let's keep it responsive) */}
                <div className="md:w-5/12 bg-gradient-to-br from-blue-600 to-blue-800 text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M0 40L40 0H20L0 20M40 40V20L20 40" stroke="white" strokeWidth="2" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <GraduationCap className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-2xl font-bold font-montserrat">Tabeeb</span>
                        </div>

                        <h2 className="text-3xl font-bold mb-6 leading-tight">
                            انضم لمجتمع أطباء الأسنان المتميز
                        </h2>

                        <div className="space-y-4">
                            {benefits.map((benefit, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                                    <benefit.icon className="w-5 h-5 text-blue-200" />
                                    <span className="text-sm font-medium">{benefit.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative z-10 mt-8 text-sm text-blue-100/80">
                        © 2026 جميع الحقوق محفوظة لمنصة طبيب
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="md:w-7/12 p-8 lg:p-12 bg-white flex flex-col justify-center">
                    <div className="max-w-md mx-auto w-full">

                        {/* Tabs */}
                        <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
                            <button
                                onClick={() => setMode('login')}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${mode === 'login'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                تسجيل الدخول
                            </button>
                            <button
                                onClick={() => setMode('register')}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${mode === 'register'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                حساب جديد
                            </button>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                {mode === 'login' ? 'أهلاً بعودتك! 👋' : 'ابدأ رحلتك معنا 🚀'}
                            </h3>
                            <p className="text-gray-500">
                                {mode === 'login'
                                    ? 'أدخل بياناتك للمتابعة'
                                    : 'أنشئ حساباً للوصول لجميع المميزات'}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-start gap-2">
                                <div className="mt-0.5 min-w-[16px]"><X size={16} /></div>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {mode === 'register' && (
                                <div className="space-y-4 animate-slideDown">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم الكامل</label>
                                        <div className="relative">
                                            <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                required
                                                className="input-modern pr-10"
                                                placeholder="مثال: أحمد محمد"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الهاتف</label>
                                        <div className="relative">
                                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="tel"
                                                required
                                                className="input-modern pr-10"
                                                dir="ltr"
                                                placeholder="+966 50 000 0000"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
                                <div className="relative">
                                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="email"
                                        required
                                        className="input-modern pr-10"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور</label>
                                <div className="relative">
                                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="password"
                                        required
                                        className="input-modern pr-10"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            {mode === 'register' && (
                                <div className="animate-slideDown">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">تأكيد كلمة المرور</label>
                                    <div className="relative">
                                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="password"
                                            required
                                            className="input-modern pr-10"
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {mode === 'login' && (
                                <div className="flex justify-end">
                                    <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                                        نسيت كلمة المرور؟
                                    </button>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary w-full py-3 flex items-center justify-center gap-2 group shadow-lg shadow-blue-200"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}</span>
                                        <ArrowRight size={18} className="group-hover:-translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center text-sm text-gray-500">
                            بمتابعة التسجيل أنت توافق على{' '}
                            <Link to="/terms" className="text-blue-600 hover:underline">الشروط والأحكام</Link>
                            {' '}و{' '}
                            <Link to="/privacy" className="text-blue-600 hover:underline">سياسة الخصوصية</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
