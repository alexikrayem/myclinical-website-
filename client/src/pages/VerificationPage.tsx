import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ShieldCheck, Upload, CheckCircle, AlertCircle, Clock,
    FileText, User, Stethoscope, Loader2, ArrowRight, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../lib/api';
import toast from 'react-hot-toast';
import { MEDICAL_SPECIALTIES } from './LoginPage';

// =============================================================================
// VerificationPage — Post-registration professional verification flow
//
// Any authenticated user can upload:
//   1. Personal ID (government-issued)
//   2. Medical/professional ID (syndicate or ministry-issued)
//   3. Practice license
// An admin reviews and approves/rejects. On approval, is_verified is set to true.
// =============================================================================

const VerificationPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, isLoading } = useAuth();

    const [currentStatus, setCurrentStatus] = useState<{
        is_verified: boolean;
        submission: {
            id: string;
            status: 'pending' | 'approved' | 'rejected';
            rejection_reason?: string | null;
            created_at: string;
        } | null;
    } | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(true);

    // Form state
    const [fullName, setFullName] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [notes, setNotes] = useState('');
    const [personalIdFile, setPersonalIdFile] = useState<File | null>(null);
    const [medicalIdFile, setMedicalIdFile] = useState<File | null>(null);
    const [practiceFile, setPracticeFile] = useState<File | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const personalIdRef = useRef<HTMLInputElement>(null);
    const medicalIdRef = useRef<HTMLInputElement>(null);
    const practiceRef = useRef<HTMLInputElement>(null);

    // Redirect unauthenticated users
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate('/login', { state: { from: { pathname: '/verify' } } });
        }
    }, [isAuthenticated, isLoading, navigate]);

    // Prefill name and specialty from user profile
    useEffect(() => {
        if (user) {
            setFullName(user.display_name || '');
            setSpecialty(user.specialty || '');
        }
    }, [user]);

    // Fetch current verification status
    useEffect(() => {
        if (!isAuthenticated) return;
        authApi.getVerificationStatus()
            .then(setCurrentStatus)
            .catch(() => { }) // Non-fatal — form still renders
            .finally(() => setLoadingStatus(false));
    }, [isAuthenticated]);

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

    const validateAndSetFile = (file: File | undefined, setter: (f: File) => void, label: string) => {
        if (!file) return;
        if (file.size > MAX_SIZE) {
            toast.error(`${label}: حجم الملف يتجاوز 10 ميغابايت`);
            return;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error(`${label}: يرجى رفع صورة (JPG/PNG/WebP) أو PDF فقط`);
            return;
        }
        setter(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!fullName.trim()) { setError('الاسم الكامل مطلوب'); return; }
        if (!specialty) { setError('التخصص مطلوب'); return; }
        if (!personalIdFile || !medicalIdFile || !practiceFile) {
            setError('يرجى رفع جميع الوثائق الثلاثة المطلوبة');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('full_name', fullName.trim());
            formData.append('specialty', specialty);
            if (notes.trim()) formData.append('notes', notes.trim());
            formData.append('personal_id', personalIdFile);
            formData.append('medical_id', medicalIdFile);
            formData.append('practice_license', practiceFile);

            await authApi.submitVerification(formData);
            toast.success('تم إرسال طلب التوثيق بنجاح! سيتم مراجعته من قبل الإدارة');
            // Refresh status
            const updated = await authApi.getVerificationStatus();
            setCurrentStatus(updated);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
                || (err as Error).message
                || 'فشل إرسال طلب التوثيق';
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const FileUploadSlot = ({
        label,
        sublabel,
        file,
        inputRef,
        onFileChange,
        testId,
    }: {
        label: string;
        sublabel: string;
        file: File | null;
        inputRef: React.RefObject<HTMLInputElement>;
        onFileChange: (f: File) => void;
        testId?: string;
    }) => (
        <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
                {label} <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 font-normal mr-1">({sublabel})</span>
            </label>
            <div
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 flex items-center gap-4 cursor-pointer transition-all ${file
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-blue-300 bg-gray-50 hover:bg-blue-50/20'
                    }`}
                data-testid={testId}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => validateAndSetFile(e.target.files?.[0], onFileChange, label)}
                />
                {file ? (
                    <>
                        <CheckCircle size={24} className="text-green-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-green-700 truncate">{file.name}</p>
                            <p className="text-xs text-green-500">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); }}
                            className="p-1 hover:bg-green-100 rounded-full"
                        >
                            <X size={16} className="text-green-600" />
                        </button>
                    </>
                ) : (
                    <>
                        <Upload size={24} className="text-gray-400 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-gray-700">اضغط لرفع الملف</p>
                            <p className="text-xs text-gray-400">JPG، PNG، WebP، PDF — حتى 10 MB</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    if (isLoading || loadingStatus) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 size={36} className="animate-spin text-blue-600" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-16">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-10 px-4">
                <div className="max-w-2xl mx-auto">
                    <Link to="/profile" className="flex items-center gap-2 text-white/80 hover:text-white text-sm mb-6 transition-colors">
                        <ArrowRight size={16} />
                        العودة للملف الشخصي
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                            <ShieldCheck size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">التوثيق المهني</h1>
                            <p className="text-white/80 text-sm mt-1">
                                قدّم وثائقك للحصول على حساب موثق ونشر المحتوى المهني
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 mt-8 space-y-6">
                {/* Current Status Banner */}
                {currentStatus?.submission && (
                    <div className={`rounded-2xl p-5 flex items-start gap-4 border shadow-sm ${currentStatus.submission.status === 'pending'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : currentStatus.submission.status === 'approved'
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                        {currentStatus.submission.status === 'pending' && <Clock size={22} className="shrink-0 mt-0.5" />}
                        {currentStatus.submission.status === 'approved' && <CheckCircle size={22} className="shrink-0 mt-0.5" />}
                        {currentStatus.submission.status === 'rejected' && <AlertCircle size={22} className="shrink-0 mt-0.5" />}
                        <div>
                            <h3 className="font-bold text-base">
                                {currentStatus.submission.status === 'pending' && 'طلبك قيد المراجعة'}
                                {currentStatus.submission.status === 'approved' && 'تم قبول طلب التوثيق'}
                                {currentStatus.submission.status === 'rejected' && 'تم رفض طلب التوثيق'}
                            </h3>
                            {currentStatus.submission.status === 'pending' && (
                                <p className="text-sm mt-1 opacity-90">تم استلام وثائقك وهي قيد مراجعة الإدارة. لا داعي لإعادة الإرسال.</p>
                            )}
                            {currentStatus.submission.status === 'rejected' && currentStatus.submission.rejection_reason && (
                                <p className="text-sm mt-1 opacity-90">
                                    <span className="font-semibold">سبب الرفض: </span>
                                    {currentStatus.submission.rejection_reason}
                                </p>
                            )}
                            {currentStatus.submission.status === 'rejected' && (
                                <p className="text-xs mt-2 opacity-75">يمكنك تقديم طلب جديد بعد تصحيح البيانات.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Form — only show if not pending or approved */}
                {(!currentStatus?.submission || currentStatus.submission.status === 'rejected') && (
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-1">بيانات التوثيق</h2>
                            <p className="text-sm text-gray-500">يجب رفع جميع الوثائق لإتمام الطلب</p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3" data-testid="verify-error">
                                <AlertCircle size={18} />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        {/* Full Name */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <User size={15} className="text-blue-500" />
                                الاسم الكامل <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="مثال: د. أحمد محمد الشريف"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                required
                                data-testid="verify-full-name"
                            />
                        </div>

                        {/* Specialty */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <Stethoscope size={15} className="text-blue-500" />
                                التخصص الطبي <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={specialty}
                                onChange={(e) => setSpecialty(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all bg-white"
                                required
                                data-testid="verify-specialty"
                            >
                                <option value="">اختر تخصصك...</option>
                                {MEDICAL_SPECIALTIES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        {/* Document uploads */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <FileText size={15} className="text-blue-500" />
                                الوثائق المطلوبة
                            </h3>

                            <FileUploadSlot
                                label="الهوية الشخصية"
                                sublabel="هوية وطنية أو جواز سفر"
                                file={personalIdFile}
                                inputRef={personalIdRef}
                                onFileChange={setPersonalIdFile}
                                testId="upload-personal-id"
                            />

                            <FileUploadSlot
                                label="الهوية المهنية"
                                sublabel="بطاقة النقابة أو الوزارة"
                                file={medicalIdFile}
                                inputRef={medicalIdRef}
                                onFileChange={setMedicalIdFile}
                                testId="upload-medical-id"
                            />

                            <FileUploadSlot
                                label="رخصة المزاولة"
                                sublabel="رخصة مزاولة المهنة السارية"
                                file={practiceFile}
                                inputRef={practiceRef}
                                onFileChange={setPracticeFile}
                                testId="upload-practice-license"
                            />
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-600">
                                ملاحظات إضافية (اختياري)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="أي معلومات إضافية قد تساعد في مراجعة طلبك..."
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all resize-none"
                                data-testid="verify-notes"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2"
                            data-testid="verify-submit"
                        >
                            {isSubmitting ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    <ShieldCheck size={20} />
                                    إرسال طلب التوثيق
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default VerificationPage;
