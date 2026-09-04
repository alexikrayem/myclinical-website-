import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
  Eye,
  Download,
  ExternalLink,
  Calendar,
  Briefcase,
  Loader2,
  FileText,
  AlertCircle,
  ShieldCheck,
  Facebook,
  Instagram,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../components/layout/AdminLayout';
import {
  verificationService,
  PendingSubmission,
  DocumentUrls,
} from '../services/verificationService';

type DocumentTab = 'personal_id' | 'medical_id' | 'practice_license';

const DOC_TAB_LABELS: Record<DocumentTab, string> = {
  personal_id: 'الهوية الشخصية',
  medical_id: 'الهوية المهنية',
  practice_license: 'رخصة المزاولة',
};

const Verifications: React.FC = () => {
  const [requests, setRequests] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PendingSubmission | null>(null);
  const [documentUrls, setDocumentUrls] = useState<DocumentUrls | null>(null);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<DocumentTab>('personal_id');

  // Rejection state
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await verificationService.getPending();
      setRequests(data);
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || 'فشل في تحميل طلبات التحقق');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = async (request: PendingSubmission) => {
    setSelectedRequest(request);
    setDocumentUrls(null);
    setIsRejecting(false);
    setRejectionReason('');
    setActiveDocTab('personal_id');
    setFetchingDocs(true);

    try {
      const urls = await verificationService.getDocumentUrls(request.id);
      setDocumentUrls(urls);
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || 'فشل في استرداد روابط الوثائق');
    } finally {
      setFetchingDocs(false);
    }
  };

  const handleCloseReview = () => {
    if (submittingAction) return;
    setSelectedRequest(null);
    setDocumentUrls(null);
    setIsRejecting(false);
    setRejectionReason('');
  };

  const handleApprove = async (id: string) => {
    if (
      !confirm(
        'هل أنت متأكد من قبول طلب التوثيق؟ سيتم تفعيل الحساب وإنشاء ملف كاتب تلقائياً.'
      )
    )
      return;

    try {
      setSubmittingAction(true);
      const res = await verificationService.approve(id);
      toast.success(res.message || 'تم قبول طلب التوثيق بنجاح');
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || 'فشل في إتمام عملية القبول');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      toast.error('يرجى تحديد سبب الرفض');
      return;
    }

    try {
      setSubmittingAction(true);
      const res = await verificationService.reject(id, rejectionReason.trim());
      toast.success(res.message || 'تم رفض الطلب بنجاح');
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || 'فشل في إتمام عملية الرفض');
    } finally {
      setSubmittingAction(false);
    }
  };

  const currentDocUrl = documentUrls
    ? documentUrls[`${activeDocTab}_url` as keyof DocumentUrls]
    : null;

  const docTabs: DocumentTab[] = ['personal_id', 'medical_id', 'practice_license'];
  const currentTabIndex = docTabs.indexOf(activeDocTab);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1
              className="text-3xl font-extrabold text-gray-950 tracking-tight"
              data-testid="admin-verifications-title"
            >
              طلبات التوثيق المهني
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              مراجعة وثائق المتخصصين الصحيين والبت في طلبات التوثيق
            </p>
          </div>
          <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-xs font-semibold border border-indigo-100 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
            </span>
            {requests.length} طلبات معلقة
          </div>
        </div>

        {/* Loading / Table / Empty States */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-8">
            <div className="space-y-4 animate-pulse">
              <div className="h-8 bg-gray-100 rounded w-1/4"></div>
              <div className="h-12 bg-gray-50 rounded"></div>
              <div className="h-20 bg-gray-50 rounded"></div>
              <div className="h-20 bg-gray-50 rounded"></div>
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center flex flex-col items-center justify-center max-w-2xl mx-auto mt-8">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">لا توجد طلبات توثيق معلقة</h3>
            <p className="text-sm text-gray-500 mt-1.5 max-w-sm">
              جميع الطلبات المقدمة تمت معالجتها. ستظهر هنا الطلبات الجديدة فور تقديمها.
            </p>
          </div>
        ) : (
          <div
            className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
            data-testid="admin-verifications-table"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-6">مقدم الطلب</th>
                    <th className="py-4 px-6">التخصص</th>
                    <th className="py-4 px-6">المنصة الاجتماعية</th>
                    <th className="py-4 px-6">تاريخ التقديم</th>
                    <th className="py-4 px-6 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-gray-50/50 transition-colors"
                      data-testid={`verification-row-${req.id}`}
                    >
                      <td className="py-4 px-6">
                        <div className="font-semibold text-gray-900">{req.full_name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {req.users?.display_name || '—'}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-600">{req.specialty}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          {req.users?.social_provider === 'facebook' && (
                            <Facebook className="w-3.5 h-3.5 text-blue-500" />
                          )}
                          {req.users?.social_provider === 'instagram' && (
                            <Instagram className="w-3.5 h-3.5 text-pink-500" />
                          )}
                          <span className="text-xs">
                            {req.users?.social_username || req.users?.social_provider || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-500">
                        {new Date(req.created_at).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-4 px-6 text-left">
                        <button
                          onClick={() => handleOpenReview(req)}
                          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm shadow-blue-100 hover:shadow-md hover:shadow-blue-200"
                          data-testid={`review-button-${req.id}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          مراجعة الوثائق
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-gray-100 flex flex-col md:flex-row overflow-hidden max-h-[92vh]">

              {/* Left Pane — Document Viewer */}
              <div className="flex-1 bg-gray-950 flex flex-col min-h-[300px] md:min-h-0 order-1">
                {/* Document tab switcher */}
                <div className="flex border-b border-gray-800">
                  {docTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveDocTab(tab)}
                      className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeDocTab === tab
                          ? 'text-white bg-gray-800 border-b-2 border-blue-400'
                          : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                      {DOC_TAB_LABELS[tab]}
                    </button>
                  ))}
                </div>

                {/* Document display */}
                <div className="flex-1 flex items-center justify-center relative p-4 overflow-hidden">
                  {/* Top-right actions */}
                  {currentDocUrl && (
                    <div className="absolute top-3 right-3 flex gap-2 z-10">
                      <a
                        href={currentDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-gray-800/90 backdrop-blur hover:bg-gray-700 text-gray-300 rounded-full transition-all"
                        title="فتح في علامة تبويب جديدة"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <a
                        href={currentDocUrl}
                        download={`${activeDocTab}-${selectedRequest.id}`}
                        className="p-2 bg-gray-800/90 backdrop-blur hover:bg-gray-700 text-gray-300 rounded-full transition-all"
                        title="تحميل"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  )}

                  {/* Navigation arrows */}
                  {currentTabIndex > 0 && (
                    <button
                      onClick={() => setActiveDocTab(docTabs[currentTabIndex - 1])}
                      className="absolute left-3 p-2 bg-gray-800/70 hover:bg-gray-700 text-gray-300 rounded-full z-10"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  {currentTabIndex < docTabs.length - 1 && (
                    <button
                      onClick={() => setActiveDocTab(docTabs[currentTabIndex + 1])}
                      className="absolute right-3 p-2 bg-gray-800/70 hover:bg-gray-700 text-gray-300 rounded-full z-10"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  {fetchingDocs ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-xs">جاري تحميل الوثائق بأمان...</p>
                    </div>
                  ) : currentDocUrl ? (
                    currentDocUrl.includes('.pdf') || currentDocUrl.includes('application/pdf') ? (
                      <iframe
                        src={currentDocUrl}
                        className="w-full h-full min-h-[300px] rounded-xl"
                        title={DOC_TAB_LABELS[activeDocTab]}
                      />
                    ) : (
                      <img
                        src={currentDocUrl}
                        alt={DOC_TAB_LABELS[activeDocTab]}
                        className="max-w-full max-h-[60vh] object-contain rounded-xl"
                      />
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <X className="w-8 h-8 mb-2" />
                      <p className="text-xs font-semibold">فشل في تحميل المستند</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane — Applicant Details */}
              <div className="w-full md:w-96 flex-shrink-0 p-6 md:p-8 overflow-y-auto border-t md:border-t-0 md:border-r border-gray-100 order-2 bg-white">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 inline-block">
                      <ShieldCheck className="inline w-3 h-3 ml-1" />
                      طلب توثيق مهني
                    </span>
                    <h2 className="text-xl font-bold text-gray-950 mt-2">
                      {selectedRequest.full_name}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      حساب: {selectedRequest.users?.display_name || '—'}
                    </p>
                  </div>
                  <button
                    onClick={handleCloseReview}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Specialty */}
                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-gray-100 bg-gray-50/40">
                    <Briefcase className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs text-gray-400">التخصص الطبي</div>
                      <div className="text-sm font-semibold text-gray-800">
                        {selectedRequest.specialty}
                      </div>
                    </div>
                  </div>

                  {/* Social profile */}
                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-gray-100 bg-gray-50/40">
                    {selectedRequest.users?.social_provider === 'facebook' ? (
                      <Facebook className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    ) : (
                      <Instagram className="w-4 h-4 text-pink-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs text-gray-400">الحساب الاجتماعي</div>
                      <div className="text-sm font-semibold text-gray-800">
                        {selectedRequest.users?.social_username ||
                          selectedRequest.users?.social_provider ||
                          '—'}
                      </div>
                      {selectedRequest.users?.social_profile_url && (
                        <a
                          href={selectedRequest.users.social_profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          عرض الملف الشخصي
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Submission date */}
                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-gray-100 bg-gray-50/40">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs text-gray-400">تاريخ التقديم</div>
                      <div className="text-sm font-semibold text-gray-800">
                        {new Date(selectedRequest.created_at).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedRequest.notes && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        ملاحظات المتقدم
                      </h3>
                      <p className="text-sm text-gray-700 bg-gray-50/70 p-4 rounded-2xl border border-gray-100 leading-relaxed">
                        {selectedRequest.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-gray-100 pt-6 mt-6">
                  {!isRejecting ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(selectedRequest.id)}
                        disabled={submittingAction}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-100"
                        data-testid="approve-button"
                      >
                        {submittingAction ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        قبول واعتماد
                      </button>

                      <button
                        onClick={() => setIsRejecting(true)}
                        disabled={submittingAction}
                        className="inline-flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 disabled:bg-gray-100 text-rose-600 disabled:text-gray-400 px-5 py-3 rounded-2xl text-sm font-bold transition-all"
                        data-testid="reject-button"
                      >
                        <X className="w-4 h-4" />
                        رفض
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 bg-rose-50/50 p-5 rounded-2xl border border-rose-100">
                      <div>
                        <label className="block text-xs font-bold text-rose-800 mb-2 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          سبب الرفض (سيُبلَّغ به المستخدم):
                        </label>
                        <textarea
                          placeholder="مثال: صورة الهوية غير واضحة، يرجى إعادة رفع صورة عالية الجودة..."
                          rows={3}
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="w-full border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400 rounded-xl p-3 text-sm"
                          data-testid="rejection-reason-textarea"
                        />
                      </div>

                      <div className="flex gap-2.5">
                        <button
                          onClick={() => handleReject(selectedRequest.id)}
                          disabled={submittingAction}
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-100"
                          data-testid="confirm-reject-button"
                        >
                          {submittingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                          تأكيد الرفض
                        </button>

                        <button
                          onClick={() => {
                            setIsRejecting(false);
                            setRejectionReason('');
                          }}
                          disabled={submittingAction}
                          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Verifications;
