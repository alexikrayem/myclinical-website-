import React, { useState, useEffect } from 'react';
import {
  Printer,
  RefreshCw,
  CreditCard,
  Copy,
  Check,
  Video,
  FileText,
  Coins,
  History,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import AdminLayout from '../components/layout/AdminLayout';
import { codeService, GeneratedCode } from '../services/codeService';
import toast from 'react-hot-toast';

type CreditType = 'universal' | 'video' | 'article' | 'both';

const GenerateCodes: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([]);

  // History state
  const [history, setHistory] = useState<GeneratedCode[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    amount: 10,
    creditValue: 100,
    videoMinutes: 60,
    articleCount: 5,
    prefix: 'GIFT',
    creditType: 'universal' as CreditType
  });

  // Fetch history
  const fetchHistory = async (pageNumber = 1) => {
    setHistoryLoading(true);
    try {
      const response = await codeService.getHistory(pageNumber, 10);
      setHistory(response.data);
      setTotalPages(response.pagination.pages);
      setPage(pageNumber);
    } catch (error) {
      console.error(error);
      toast.error('فشل تحميل سجل الأكواد');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await codeService.generate(
        formData.amount,
        formData.creditType === 'universal' ? formData.creditValue : 0,
        formData.prefix,
        formData.creditType,
        formData.creditType === 'video' || formData.creditType === 'both'
          ? formData.videoMinutes
          : 0,
        formData.creditType === 'article' || formData.creditType === 'both'
          ? formData.articleCount
          : 0
      );

      setGeneratedCodes(response.codes);
      toast.success('تم توليد الأكواد بنجاح');

      // refresh history
      fetchHistory(1);
    } catch (error) {
      console.error(error);
      toast.error('فشل توليد الأكواد');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('تم نسخ الكود');
  };

  const getCreditTypeLabel = (type: CreditType) => {
    switch (type) {
      case 'video':
        return 'دقائق مشاهدة';
      case 'article':
        return 'مقالات';
      case 'both':
        return 'مشاهدة + مقالات';
      default:
        return 'رصيد عام';
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
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            توليد بطاقات الرصيد
          </h1>
          <p className="text-gray-600">
            قم بتوليد وطباعة أكواد شحن الرصيد للمستخدمين
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <form onSubmit={handleGenerate} className="space-y-6">
            {/* credit type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                نوع الرصيد
              </label>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: 'universal', label: 'رصيد عام', icon: Coins, color: 'yellow' },
                  { value: 'video', label: 'دقائق مشاهدة', icon: Video, color: 'blue' },
                  { value: 'article', label: 'مقالات', icon: FileText, color: 'green' },
                  { value: 'both', label: 'مشاهدة + مقالات', icon: CreditCard, color: 'purple' }
                ].map(({ value, label, icon: Icon, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, creditType: value as CreditType })
                    }
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${
                      formData.creditType === value
                        ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <Icon size={24} />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* inputs */}
            <div className="grid md:grid-cols-4 gap-6 items-end">
              <div>
                <label className="block text-sm mb-2">عدد البطاقات</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="w-full border rounded-xl px-4 py-2"
                  value={formData.amount}
                  onChange={e =>
                    setFormData({ ...formData, amount: parseInt(e.target.value) })
                  }
                />
              </div>

              {formData.creditType === 'universal' && (
                <div>
                  <label className="block text-sm mb-2">قيمة الرصيد</label>
                  <input
                    type="number"
                    className="w-full border rounded-xl px-4 py-2"
                    value={formData.creditValue}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        creditValue: parseInt(e.target.value)
                      })
                    }
                  />
                </div>
              )}

              {(formData.creditType === 'video' ||
                formData.creditType === 'both') && (
                <div>
                  <label className="block text-sm mb-2">دقائق المشاهدة</label>
                  <input
                    type="number"
                    className="w-full border rounded-xl px-4 py-2"
                    value={formData.videoMinutes}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        videoMinutes: parseInt(e.target.value)
                      })
                    }
                  />
                </div>
              )}

              {(formData.creditType === 'article' ||
                formData.creditType === 'both') && (
                <div>
                  <label className="block text-sm mb-2">عدد المقالات</label>
                  <input
                    type="number"
                    className="w-full border rounded-xl px-4 py-2"
                    value={formData.articleCount}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        articleCount: parseInt(e.target.value)
                      })
                    }
                  />
                </div>
              )}

              <div>
                <label className="block text-sm mb-2">بادئة الكود</label>
                <input
                  type="text"
                  className="w-full border rounded-xl px-4 py-2 uppercase"
                  value={formData.prefix}
                  onChange={e =>
                    setFormData({ ...formData, prefix: e.target.value.toUpperCase() })
                  }
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white rounded-xl px-6 py-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <RefreshCw size={18} /> توليد الأكواد
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Generated result banner */}
        {generatedCodes.length > 0 && (
          <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2 text-blue-800">
              <Check size={20} />
              <span className="font-medium">
                تم توليد {generatedCodes.length} كود | النوع:{' '}
                {getCreditTypeLabel(formData.creditType)} | القيمة:{' '}
                {getValueDisplay()}
              </span>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border"
            >
              <Printer size={18} /> طباعة البطاقات
            </button>
          </div>
        )}

        {/* HISTORY TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <History size={20} /> سجل الأكواد
            </h2>
            <button
              onClick={() => fetchHistory(page)}
              className="text-blue-600 text-sm"
            >
              تحديث
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50 text-sm">
                <tr>
                  <th className="px-6 py-4">الكود</th>
                  <th className="px-6 py-4">النوع</th>
                  <th className="px-6 py-4">القيمة</th>
                  <th className="px-6 py-4">الحالة</th>
                  <th className="px-6 py-4">التاريخ</th>
                  <th className="px-6 py-4">نسخ</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center">
                      جاري التحميل...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center">
                      لا يوجد سجل
                    </td>
                  </tr>
                ) : (
                  history.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="px-6 py-4 font-mono dir-ltr">{item.code}</td>
                      <td className="px-6 py-4">
                        {getCreditTypeLabel(
                          (item.credit_type as CreditType) || 'universal'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {item.credit_type === 'universal' &&
                          `${item.credit_amount} رصيد`}
                        {item.credit_type === 'video' &&
                          `${item.video_minutes} دقيقة`}
                        {item.credit_type === 'article' &&
                          `${item.article_count} مقال`}
                        {item.credit_type === 'both' &&
                          `${item.video_minutes}د / ${item.article_count}م`}
                      </td>
                      <td className="px-6 py-4">
                        {item.is_redeemed ? 'مستخدم' : 'نشط'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(item.created_at).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => copyToClipboard(item.code)}>
                          <Copy size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="p-4 flex justify-between bg-gray-50">
            <button
              onClick={() => fetchHistory(page - 1)}
              disabled={page === 1}
              className="border p-2 rounded"
            >
              <ArrowRight size={16} />
            </button>
            <span>
              صفحة {page} من {totalPages}
            </span>
            <button
              onClick={() => fetchHistory(page + 1)}
              disabled={page === totalPages}
              className="border p-2 rounded"
            >
              <ArrowLeft size={16} />
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default GenerateCodes;
