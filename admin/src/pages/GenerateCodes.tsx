import React, { useState } from 'react';
import { Printer, RefreshCw, CreditCard, Copy, Check, Video, FileText, Coins } from 'lucide-react';
import AdminLayout from '../components/layout/AdminLayout';
import { codeService, GeneratedCode } from '../services/codeService';
import toast from 'react-hot-toast';

type CreditType = 'universal' | 'video' | 'article' | 'both';

const GenerateCodes: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([]);
    const [formData, setFormData] = useState({
        amount: 10,
        creditValue: 100, // For universal type
        videoMinutes: 60, // For video type
        articleCount: 5,  // For article type
        prefix: 'GIFT',
        creditType: 'universal' as CreditType
    });

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await codeService.generate(
                formData.amount,
                formData.creditType === 'universal' ? formData.creditValue : 0,
                formData.prefix,
                formData.creditType,
                formData.creditType === 'video' || formData.creditType === 'both' ? formData.videoMinutes : 0,
                formData.creditType === 'article' || formData.creditType === 'both' ? formData.articleCount : 0
            );
            setGeneratedCodes(response.codes);
            toast.success('تم توليد الأكواد بنجاح');
        } catch (error) {
            console.error('Error generating codes:', error);
            toast.error('فشل توليد الأكواد');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success('تم نسخ الكود');
    };

    const getCreditTypeLabel = (type: CreditType) => {
        switch (type) {
            case 'video': return 'دقائق مشاهدة';
            case 'article': return 'مقالات';
            case 'both': return 'مشاهدة + مقالات';
            default: return 'رصيد عام';
        }
    };

    const getCreditTypeIcon = (type: CreditType) => {
        switch (type) {
            case 'video': return <Video size={16} className="text-blue-400" />;
            case 'article': return <FileText size={16} className="text-green-400" />;
            case 'both': return <CreditCard size={16} className="text-purple-400" />;
            default: return <Coins size={16} className="text-yellow-400" />;
        }
    };

    const getValueDisplay = () => {
        switch (formData.creditType) {
            case 'video':
                return `${formData.videoMinutes} دقيقة`;
            case 'article':
                return `${formData.articleCount} مقال`;
            case 'both':
                return `${formData.videoMinutes} دقيقة + ${formData.articleCount} مقال`;
            default:
                return `${formData.creditValue} رصيد`;
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-8 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">توليد بطاقات الرصيد</h1>
                    <p className="text-gray-600">قم بتوليد وطباعة أكواد شحن الرصيد للمستخدمين</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <form onSubmit={handleGenerate} className="space-y-6">
                        {/* Credit Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">نوع الرصيد</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { value: 'universal', label: 'رصيد عام', icon: Coins, color: 'yellow' },
                                    { value: 'video', label: 'دقائق مشاهدة', icon: Video, color: 'blue' },
                                    { value: 'article', label: 'مقالات', icon: FileText, color: 'green' },
                                    { value: 'both', label: 'مشاهدة + مقالات', icon: CreditCard, color: 'purple' },
                                ].map(({ value, label, icon: Icon, color }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, creditType: value as CreditType })}
                                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.creditType === value
                                                ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                            }`}
                                    >
                                        <Icon size={24} className={formData.creditType === value ? `text-${color}-500` : 'text-gray-400'} />
                                        <span className="text-sm font-medium">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Value Inputs based on type */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">عدد البطاقات</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    required
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: parseInt(e.target.value) })}
                                />
                            </div>

                            {/* Universal Credits */}
                            {formData.creditType === 'universal' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">قيمة الرصيد</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                        value={formData.creditValue}
                                        onChange={e => setFormData({ ...formData, creditValue: parseInt(e.target.value) })}
                                    />
                                </div>
                            )}

                            {/* Video Minutes */}
                            {(formData.creditType === 'video' || formData.creditType === 'both') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">دقائق المشاهدة</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                        value={formData.videoMinutes}
                                        onChange={e => setFormData({ ...formData, videoMinutes: parseInt(e.target.value) })}
                                    />
                                </div>
                            )}

                            {/* Article Count */}
                            {(formData.creditType === 'article' || formData.creditType === 'both') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">عدد المقالات</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                        value={formData.articleCount}
                                        onChange={e => setFormData({ ...formData, articleCount: parseInt(e.target.value) })}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">بادئة الكود</label>
                                <input
                                    type="text"
                                    placeholder="مثال: SUMMER"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all uppercase"
                                    value={formData.prefix}
                                    onChange={e => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[42px]"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <RefreshCw size={20} />
                                        توليد الأكواد
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {generatedCodes.length > 0 && (
                    <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-800">
                            <Check size={20} />
                            <span className="font-medium">
                                تم توليد {generatedCodes.length} كود | النوع: {getCreditTypeLabel(formData.creditType)} | القيمة: {getValueDisplay()}
                            </span>
                        </div>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            <Printer size={18} />
                            طباعة البطاقات
                        </button>
                    </div>
                )}
            </div>

            {/* Printable Area */}
            {generatedCodes.length > 0 && (
                <div className="mt-8 print:mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-4">
                        {generatedCodes.map((item, index) => (
                            <div key={index} className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 rounded-xl shadow-lg print:shadow-none print:border print:border-gray-300 print:break-inside-avoid relative overflow-hidden">
                                {/* Background Pattern */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full -ml-12 -mb-12 blur-xl"></div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                                {getCreditTypeIcon(formData.creditType)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm">بطاقة شحن رصيد</h3>
                                                <p className="text-xs text-gray-400">{getCreditTypeLabel(formData.creditType)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {formData.creditType === 'universal' && (
                                                <>
                                                    <span className="block text-2xl font-bold text-yellow-400">{formData.creditValue}</span>
                                                    <span className="text-xs text-gray-400">رصيد</span>
                                                </>
                                            )}
                                            {formData.creditType === 'video' && (
                                                <>
                                                    <span className="block text-2xl font-bold text-blue-400">{formData.videoMinutes}</span>
                                                    <span className="text-xs text-gray-400">دقيقة</span>
                                                </>
                                            )}
                                            {formData.creditType === 'article' && (
                                                <>
                                                    <span className="block text-2xl font-bold text-green-400">{formData.articleCount}</span>
                                                    <span className="text-xs text-gray-400">مقال</span>
                                                </>
                                            )}
                                            {formData.creditType === 'both' && (
                                                <div className="flex gap-3">
                                                    <div>
                                                        <span className="block text-lg font-bold text-blue-400">{formData.videoMinutes}</span>
                                                        <span className="text-xs text-gray-400">دق</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-lg font-bold text-green-400">{formData.articleCount}</span>
                                                        <span className="text-xs text-gray-400">مقال</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/10 mb-4">
                                        <p className="text-center font-mono text-lg tracking-wider font-bold dir-ltr select-all">
                                            {item.code}
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-end">
                                        <p className="text-[10px] text-gray-400 max-w-[70%]">
                                            قم بإدخال هذا الكود في صفحة "شحن الرصيد" للحصول على النقاط فوراً.
                                        </p>
                                        <button
                                            onClick={() => copyToClipboard(item.code)}
                                            className="print:hidden p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white"
                                            title="نسخ الكود"
                                        >
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Print Styles */}
            <style>{`
        @media print {
          @page { margin: 1cm; }
          body * { visibility: hidden; }
          #root { visibility: visible; }
          .print\\:hidden { display: none !important; }
          .sidebar, header { display: none !important; }
          .admin-layout-content { margin: 0 !important; padding: 0 !important; }
          .card-shadow { box-shadow: none !important; border: 1px solid #eee; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
        </AdminLayout>
    );
};

export default GenerateCodes;
