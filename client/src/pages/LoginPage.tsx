import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AlertCircle, Facebook, Instagram, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { authApi } from '../lib/api';

// =============================================================================
// Medical specialty picker (shared with RegisterPage / VerificationPage)
// =============================================================================
export const MEDICAL_SPECIALTIES = [
    // Core dental (primary audience of platform)
    'طب الأسنان العام',
    'تقويم الأسنان',
    'جراحة الفم والأسنان والوجه والفكين',
    'طب أسنان الأطفال',
    'طب اللثة وأمراض الدعامة',
    'علاج جذور الأسنان',
    'تجميل الأسنان وطب التجميل',
    'أطراف أسنان ثابتة ومتحركة',
    // Common broad specialties
    'الطب العام',
    'طب الأسرة',
    'الباطنة والأمراض الداخلية',
    'الجراحة العامة',
    'طب الطوارئ والإسعاف',
    'طب الأطفال وحديثي الولادة',
    'النساء والتوليد',
    'طب القلب والأوعية الدموية',
    'الجراحة التجميلية وإعادة التشكيل',
    'جراحة العظام والمفاصل',
    'الجهاز العصبي وجراحة الأعصاب',
    'الأمراض الجلدية والتناسلية',
    'طب العيون',
    'الأذن والأنف والحنجرة',
    'الصدر والجهاز التنفسي وأمراض الرئة',
    'الكلى والمسالك البولية',
    'الأمراض النفسية والعقلية',
    'الأمراض العضلية الهيكلية والروماتيزم',
    'الأمراض المعدية والطب الوقائي',
    'الجهاز الهضمي والكبد',
    'الغدد الصماء والسكري',
    'الأورام والأمراض الخبيثة',
    'التخدير والعناية المركزة'
];

// =============================================================================
// OAuth helpers
// =============================================================================

const buildFacebookOAuthUrl = (provider: 'facebook' | 'instagram', appId: string, redirectUri: string, scopes: Record<string, string>): string => {
    const scope = scopes[provider] || 'public_profile';
    const state = `${provider}:${Math.random().toString(36).slice(2)}`;
    // Store state in sessionStorage for CSRF validation on callback
    sessionStorage.setItem('oauth_state', state);
    const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        scope,
        response_type: 'code',
        state,
    });
    return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
};

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { socialLogin, isLoading, isAuthenticated } = useAuth();

    const [oauthConfig, setOauthConfig] = useState<{
        appId: string;
        redirectUri: string;
        scopes: Record<string, string>;
    } | null>(null);

    const [error, setError] = useState('');
    const [isHandlingCallback, setIsHandlingCallback] = useState(false);

    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';

    // Redirect already-authenticated users
    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, isLoading, from, navigate]);

    // Fetch public OAuth config on mount
    useEffect(() => {
        authApi.getSocialConfig().then(setOauthConfig).catch(() => {
            setError('تعذّر تحميل إعدادات تسجيل الدخول. يرجى إعادة تحميل الصفحة.');
        });
    }, []);

    // ── Handle OAuth callback if we are on /auth/callback ──────────────────────
    useEffect(() => {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');

        if (!code && !errorParam) return;

        if (errorParam) {
            setError('تم إلغاء تسجيل الدخول أو رفض الصلاحيات من المنصة الاجتماعية');
            navigate('/login', { replace: true });
            return;
        }

        if (!code) return;

        // Validate state (CSRF)
        const savedState = sessionStorage.getItem('oauth_state');
        sessionStorage.removeItem('oauth_state');
        if (!savedState || !state || !savedState.startsWith(state.split(':')[0])) {
            setError('فشل التحقق من الأمان (state mismatch). يرجى المحاولة مرة أخرى.');
            navigate('/login', { replace: true });
            return;
        }

        const provider = state.split(':')[0] as 'facebook' | 'instagram';

        setIsHandlingCallback(true);
        socialLogin(provider, code)
            .then(({ isNewUser }) => {
                if (isNewUser) {
                    // New users whose specialty wasn't set yet (edge case) go to register to pick specialty
                    toast.success('تم إنشاء حسابك بنجاح! مرحباً بك');
                } else {
                    toast.success('تم تسجيل الدخول بنجاح!');
                }
                navigate(from, { replace: true });
            })
            .catch((err: Error) => {
                const msg = err.message || 'فشل تسجيل الدخول';
                if (msg.includes('SPECIALTY_REQUIRED')) {
                    // Redirect to register to complete the specialty step
                    navigate('/register', { state: { provider, code, from }, replace: true });
                } else {
                    setError(msg);
                    navigate('/login', { replace: true });
                }
            })
            .finally(() => setIsHandlingCallback(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const handleSocialLogin = (provider: 'facebook' | 'instagram') => {
        if (!oauthConfig) {
            toast.error('إعدادات تسجيل الدخول غير جاهزة. يرجى الانتظار لحظة.');
            return;
        }
        const url = buildFacebookOAuthUrl(
            provider,
            oauthConfig.appId,
            oauthConfig.redirectUri,
            oauthConfig.scopes
        );
        window.location.href = url;
    };

    if (isHandlingCallback || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={40} className="animate-spin text-blue-600" />
                    <p className="text-gray-600 font-medium">جاري تسجيل الدخول...</p>
                </div>
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
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">مرحباً بعودتك</h1>
                    <p className="text-gray-600">سجّل دخولك عبر حسابك الاجتماعي</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 mb-6 animate-fadeIn" data-testid="login-error">
                            <AlertCircle size={20} />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <p className="text-center text-sm text-gray-500 mb-6">اختر منصتك للمتابعة</p>

                    <div className="space-y-3">
                        {/* Facebook Login */}
                        <button
                            id="login-facebook"
                            onClick={() => handleSocialLogin('facebook')}
                            disabled={!oauthConfig}
                            className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-2xl transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 active:scale-[0.98]"
                            data-testid="login-facebook"
                        >
                            <Facebook size={22} />
                            المتابعة بحساب فيسبوك
                        </button>

                        {/* Instagram Login */}
                        <button
                            id="login-instagram"
                            onClick={() => handleSocialLogin('instagram')}
                            disabled={!oauthConfig}
                            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                            data-testid="login-instagram"
                        >
                            <Instagram size={22} />
                            المتابعة بحساب إنستغرام
                        </button>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                        <p className="text-gray-600 text-sm">
                            ليس لديك حساب؟{' '}
                            <Link
                                to="/register"
                                state={{ from: location.state?.from }}
                                className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                                إنشاء حساب جديد
                            </Link>
                        </p>
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

export default LoginPage;
