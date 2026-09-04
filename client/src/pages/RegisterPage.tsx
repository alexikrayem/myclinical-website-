import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Facebook, Instagram, ChevronDown, Check, Stethoscope, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { authApi } from '../lib/api';
import { MEDICAL_SPECIALTIES } from './LoginPage';

// =============================================================================
// RegisterPage — Multi-step social sign-up flow
//
// Step 1: Choose social login provider
// Step 2 (reached via OAuth callback redirect with ?code=... + state from provider):
//         Pick specialty → completes account creation on backend
// =============================================================================

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { socialLogin, isAuthenticated, isLoading } = useAuth();

    // locationState may carry { provider, code, from } if LoginPage redirected here
    // because the backend returned SPECIALTY_REQUIRED for an in-progress OAuth flow.
    const locationState = location.state as {
        provider?: 'facebook' | 'instagram';
        code?: string;
        from?: { pathname?: string };
    } | null;

    const from = locationState?.from?.pathname || '/';

    // ── Step management ──────────────────────────────────────────────────────────
    // step 1 = provider selection
    // step 2 = specialty selection (after OAuth code received)
    const [step, setStep] = useState<1 | 2>(
        locationState?.code ? 2 : 1
    );

    const [selectedProvider, setSelectedProvider] = useState<'facebook' | 'instagram' | null>(
        locationState?.provider || null
    );
    const [oauthCode, setOauthCode] = useState<string>(locationState?.code || '');
    const [specialty, setSpecialty] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    const [oauthConfig, setOauthConfig] = useState<{
        appId: string;
        redirectUri: string;
        scopes: Record<string, string>;
    } | null>(null);

    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Redirect already-authenticated users
    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, isLoading, from, navigate]);

    // Fetch OAuth config
    useEffect(() => {
        authApi.getSocialConfig().then(setOauthConfig).catch(() => {
            setError('تعذّر تحميل إعدادات تسجيل الدخول.');
        });
    }, []);

    // ── Initiate OAuth for provider selection ────────────────────────────────────
    const handlePickProvider = (provider: 'facebook' | 'instagram') => {
        if (!oauthConfig) {
            toast.error('إعدادات تسجيل الدخول غير جاهزة. يرجى الانتظار.');
            return;
        }
        setSelectedProvider(provider);
        const state = `${provider}:${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem('oauth_state', state);
        // Embed a register flag in state so /auth/callback (LoginPage) knows to redirect here
        sessionStorage.setItem('oauth_purpose', 'register');
        const scope = oauthConfig.scopes[provider] || 'public_profile';
        const params = new URLSearchParams({
            client_id: oauthConfig.appId,
            redirect_uri: oauthConfig.redirectUri,
            scope,
            response_type: 'code',
            state,
        });
        window.location.href = `https://www.facebook.com/dialog/oauth?${params.toString()}`;
    };

    // ── Complete registration with specialty ─────────────────────────────────────
    const handleCompleteSignup = async () => {
        if (!specialty) {
            setError('يرجى اختيار تخصصك الطبي للمتابعة');
            return;
        }
        if (!oauthCode || !selectedProvider) {
            setError('بيانات المصادقة مفقودة. يرجى إعادة المحاولة من الخطوة الأولى.');
            return;
        }

        setError('');
        setIsSubmitting(true);
        try {
            await socialLogin(selectedProvider, oauthCode, specialty);
            toast.success('تم إنشاء حسابك بنجاح! مرحباً بك في المنصة');
            navigate(from, { replace: true });
        } catch (err: unknown) {
            const msg = (err as Error).message || 'فشل إنشاء الحساب';
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredSpecialties = MEDICAL_SPECIALTIES.filter((s) =>
        s.includes(specialtyFilter)
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 size={36} className="animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block mb-6">
                        <img src="/logo.png" alt="MyClinical" className="h-20 mx-auto" />
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">إنشاء حساب جديد</h1>
                    <p className="text-gray-600">انضم إلى مجتمع الأطباء والمتخصصين الصحيين</p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                    {/* Step indicator */}
                    <div className="flex border-b border-gray-100">
                        {(['اختر طريقة التسجيل', 'اختر تخصصك'] as const).map((label, i) => (
                            <div
                                key={i}
                                className={`flex-1 py-3 text-center text-xs font-semibold transition-colors ${step === i + 1
                                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/40'
                                        : step > i + 1
                                            ? 'text-green-600 bg-green-50/20'
                                            : 'text-gray-400'
                                    }`}
                            >
                                {step > i + 1 ? <Check size={14} className="inline" /> : `${i + 1}.`} {label}
                            </div>
                        ))}
                    </div>

                    <div className="p-8">
                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 mb-6 animate-fadeIn" data-testid="register-error">
                                <AlertCircle size={18} />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        {/* ────────────────────────────── STEP 1 ─────────────────────────── */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <p className="text-center text-sm text-gray-500 mb-6">
                                    اختر حسابك الاجتماعي لإنشاء حسابك على المنصة بسرعة وأمان
                                </p>

                                <button
                                    id="register-facebook"
                                    onClick={() => handlePickProvider('facebook')}
                                    disabled={!oauthConfig}
                                    className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-50 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all shadow-md shadow-blue-200 hover:shadow-lg active:scale-[0.98]"
                                    data-testid="register-facebook"
                                >
                                    <Facebook size={22} />
                                    التسجيل بحساب فيسبوك
                                </button>

                                <button
                                    id="register-instagram"
                                    onClick={() => handlePickProvider('instagram')}
                                    disabled={!oauthConfig}
                                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                                    data-testid="register-instagram"
                                >
                                    <Instagram size={22} />
                                    التسجيل بحساب إنستغرام
                                </button>

                                <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                                    <p className="text-gray-600 text-sm">
                                        لديك حساب بالفعل؟{' '}
                                        <Link to="/login" state={{ from: location.state?.from }} className="text-blue-600 hover:text-blue-700 font-medium">
                                            تسجيل الدخول
                                        </Link>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ────────────────────────────── STEP 2 ─────────────────────────── */}
                        {step === 2 && (
                            <div className="space-y-6">
                                {selectedProvider && (
                                    <div className={`flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium ${selectedProvider === 'facebook'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                            : 'bg-pink-50 text-pink-700 border border-pink-100'
                                        }`}>
                                        {selectedProvider === 'facebook' ? <Facebook size={16} /> : <Instagram size={16} />}
                                        تسجيل عبر {selectedProvider === 'facebook' ? 'فيسبوك' : 'إنستغرام'}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <Stethoscope size={16} className="text-blue-500" />
                                        التخصص الطبي <span className="text-red-500">*</span>
                                    </label>
                                    <p className="text-xs text-gray-500 mb-3">
                                        حدد تخصصك لنوفر لك محتوى مخصصاً ومناسباً لمجال عملك
                                    </p>

                                    {/* Custom searchable dropdown */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            id="specialty-selector"
                                            onClick={() => setShowDropdown((v) => !v)}
                                            className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl bg-white hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all text-right"
                                            data-testid="specialty-selector"
                                        >
                                            <span className={specialty ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                                                {specialty || 'اختر تخصصك...'}
                                            </span>
                                            <ChevronDown
                                                size={18}
                                                className={`text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                                            />
                                        </button>

                                        {showDropdown && (
                                            <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                                                <div className="p-2 border-b border-gray-100">
                                                    <input
                                                        type="text"
                                                        placeholder="ابحث عن تخصصك..."
                                                        value={specialtyFilter}
                                                        onChange={(e) => setSpecialtyFilter(e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                        autoFocus
                                                        data-testid="specialty-search"
                                                    />
                                                </div>
                                                <div className="max-h-56 overflow-y-auto">
                                                    {filteredSpecialties.length === 0 ? (
                                                        <p className="text-center text-sm text-gray-400 py-4">لا توجد نتائج</p>
                                                    ) : (
                                                        filteredSpecialties.map((s) => (
                                                            <button
                                                                key={s}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSpecialty(s);
                                                                    setShowDropdown(false);
                                                                    setSpecialtyFilter('');
                                                                }}
                                                                className={`w-full text-right px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-between ${specialty === s ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                                                                    }`}
                                                            >
                                                                {s}
                                                                {specialty === s && <Check size={14} />}
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    id="register-complete"
                                    onClick={handleCompleteSignup}
                                    disabled={isSubmitting || !specialty}
                                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-2xl transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2"
                                    data-testid="register-submit"
                                >
                                    {isSubmitting ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        <>
                                            <Check size={20} />
                                            إنشاء حسابي
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setStep(1); setOauthCode(''); setSelectedProvider(null); setError(''); }}
                                    className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 text-sm py-2"
                                >
                                    <ArrowLeft size={14} />
                                    العودة لاختيار طريقة التسجيل
                                </button>
                            </div>
                        )}
                    </div>
                </div>

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
