import React, { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, UserPlus, AlertCircle, User, CheckCircle, Stethoscope, GraduationCap, MapPin, Briefcase, FileImage, Mail, Globe, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { register, registerDoctor, isLoading } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Standard fields
    const [phoneNumber, setPhoneNumber] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Doctor specific fields
    const [isDoctor, setIsDoctor] = useState(false);
    const [specialization, setSpecialization] = useState('');
    const [bio, setBio] = useState('');
    const [education, setEducation] = useState('');
    const [experienceYears, setExperienceYears] = useState(1);
    const [clinicAddress, setClinicAddress] = useState('');
    const [email, setEmail] = useState('');
    const [website, setWebsite] = useState('');
    const [syndicateCard, setSyndicateCard] = useState<File | null>(null);
    const [cardPreview, setCardPreview] = useState<string>('');

    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';

    // Password validation
    const hasMinLength = password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const passwordsMatch = password === confirmPassword && password.length > 0;
    const isPasswordValid = hasMinLength && hasLetter && hasNumber;
    const isPhoneValid = /^09\d{8}$/.test(phoneNumber);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('حجم الصورة كبير جداً، الحد الأقصى هو 5 ميغابايت');
                return;
            }
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                toast.error('صيغة الملف غير مدعومة، يرجى رفع صورة بصيغة JPG أو PNG أو WebP');
                return;
            }
            setSyndicateCard(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCardPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!isPhoneValid) {
            setError('رقم الهاتف يجب أن يكون بالصيغة 09xxxxxxxx');
            return;
        }

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
            if (isDoctor) {
                if (!displayName.trim()) {
                    setError('الاسم الكامل مطلوب للطبيب للظهور في المنصة');
                    setIsSubmitting(false);
                    return;
                }
                if (!specialization.trim() || !bio.trim() || !education.trim() || !clinicAddress.trim()) {
                    setError('يرجى ملء جميع الحقول المطلوبة لتوثيق حساب الطبيب');
                    setIsSubmitting(false);
                    return;
                }
                if (!syndicateCard) {
                    setError('يرجى تحميل صورة بطاقة النقابة أو الهوية المهنية للمراجعة');
                    setIsSubmitting(false);
                    return;
                }

                const formData = new FormData();
                formData.append('phone_number', phoneNumber);
                formData.append('password', password);
                formData.append('display_name', displayName);
                formData.append('specialization', specialization);
                formData.append('bio', bio);
                formData.append('education', education);
                formData.append('experience_years', experienceYears.toString());
                formData.append('clinic_address', clinicAddress);
                if (email) formData.append('email', email);
                if (website) formData.append('website', website);
                formData.append('syndicate_card', syndicateCard);

                await registerDoctor(formData);
                toast.success('تم تسجيل الحساب بنجاح وطلب التحقق قيد المراجعة!');
            } else {
                await register(phoneNumber, password, displayName || undefined);
                toast.success('تم إنشاء الحساب بنجاح!');
            }
            navigate(from, { replace: true });
        } catch (err: unknown) {
            setError((err as Error).message || 'فشل إنشاء الحساب');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatPhoneNumber = (value: string) => {
        const cleaned = value.replace(/[^\d+]/g, '');
        let digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
        if (digits.startsWith('963')) {
            digits = `0${digits.slice(3)}`;
        }
        digits = digits.replace(/\D/g, '').slice(0, 10);
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
                        {/* Selector for Reader vs Doctor */}
                        <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-2xl mb-6">
                            <button
                                type="button"
                                onClick={() => { setIsDoctor(false); setError(''); }}
                                className={`py-3 text-sm font-medium rounded-xl transition-all ${!isDoctor ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                حساب قارئ
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsDoctor(true); setError(''); }}
                                className={`py-3 text-sm font-medium rounded-xl transition-all ${isDoctor ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                حساب طبيب
                            </button>
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <div
                                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-fadeIn"
                                data-testid="register-error"
                            >
                                <AlertCircle size={20} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Display Name Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                {isDoctor ? (
                                    <>
                                        الاسم الكامل <span className="text-red-500">*</span>
                                    </>
                                ) : (
                                    'الاسم (اختياري)'
                                )}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder={isDoctor ? "مثال: د. أحمد الشريف" : "اسمك الكريم"}
                                    className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    data-testid="register-display-name"
                                    required={isDoctor}
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
                                    data-testid="register-phone"
                                />
                                <Phone size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>

                        {/* Doctor specific fields */}
                        {isDoctor && (
                            <div className="space-y-4 pt-2 border-t border-gray-100 animate-fadeIn">
                                <div className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-1">
                                    <Sparkles size={16} />
                                    <span>البيانات المهنية للطبيب</span>
                                </div>
                                
                                {/* Specialization */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        التخصص الطبي <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={specialization}
                                            onChange={(e) => setSpecialization(e.target.value)}
                                            placeholder="مثال: تقويم الأسنان، جراحة الفك"
                                            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            required={isDoctor}
                                        />
                                        <Stethoscope size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>

                                {/* Education */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        التحصيل العلمي <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={education}
                                            onChange={(e) => setEducation(e.target.value)}
                                            placeholder="مثال: دكتوراه في طب الأسنان من جامعة دمشق"
                                            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            required={isDoctor}
                                        />
                                        <GraduationCap size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>

                                {/* Experience Years */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        سنوات الخبرة <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            value={experienceYears}
                                            onChange={(e) => setExperienceYears(parseInt(e.target.value) || 1)}
                                            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            required={isDoctor}
                                        />
                                        <Briefcase size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>

                                {/* Clinic Address */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        عنوان العيادة <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={clinicAddress}
                                            onChange={(e) => setClinicAddress(e.target.value)}
                                            placeholder="مثال: دمشق - شارع بغداد"
                                            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            required={isDoctor}
                                        />
                                        <MapPin size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>

                                {/* Email (Optional) */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        البريد الإلكتروني المهني (اختياري)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="doctor@example.com"
                                            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-left"
                                            dir="ltr"
                                        />
                                        <Mail size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>

                                {/* Website (Optional) */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        الموقع الإلكتروني (اختياري)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="url"
                                            value={website}
                                            onChange={(e) => setWebsite(e.target.value)}
                                            placeholder="https://..."
                                            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-left"
                                            dir="ltr"
                                        />
                                        <Globe size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>

                                {/* Bio */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        النبذة التعريفية (السيرة المهنية) <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="اكتب نبذة مختصرة عن خبراتك ومجال عملك ليعرض للقرّاء..."
                                        rows={3}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                        required={isDoctor}
                                    />
                                </div>

                                {/* Syndicate Card Image Upload */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        صورة بطاقة النقابة أو الهوية المهنية <span className="text-red-500">*</span>
                                    </label>
                                    
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-200 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-gray-50 hover:bg-blue-50/25"
                                    >
                                        <input 
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        
                                        {cardPreview ? (
                                            <div className="relative w-full max-h-40 overflow-hidden rounded-xl">
                                                <img src={cardPreview} alt="Syndicate Card Preview" className="w-full h-full object-contain" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                                                    <span className="text-white text-xs font-semibold">تغيير الصورة</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center space-y-2">
                                                <div className="p-3 bg-white rounded-full shadow-sm inline-block text-blue-600">
                                                    <FileImage size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">اضغط لرفع الصورة</p>
                                                    <p className="text-xs text-gray-500">صيغ PNG, JPG, WebP حتى 5MB</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

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
                                    data-testid="register-password"
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
                                    data-testid="register-confirm-password"
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
                            data-testid="register-submit"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <UserPlus size={20} />
                                    {isDoctor ? 'تقديم طلب تسجيل طبيب' : 'إنشاء الحساب'}
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
