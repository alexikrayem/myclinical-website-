import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
  Eye,
  Download,
  ExternalLink,
  Calendar,
  Award,
  MapPin,
  Briefcase,
  GraduationCap,
  Phone,
  Mail,
  Globe,
  Loader2,
  FileText,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../components/layout/AdminLayout';
import { verificationService, PendingDoctor } from '../services/verificationService';

const Verifications: React.FC = () => {
  const [requests, setRequests] = useState<PendingDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PendingDoctor | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [fetchingCard, setFetchingCard] = useState(false);
  
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
    } catch (error: any) {
      console.error('Error fetching verifications:', error);
      toast.error(error.message || 'فشل في تحميل طلبات التحقق');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = async (request: PendingDoctor) => {
    setSelectedRequest(request);
    setCardUrl(null);
    setIsRejecting(false);
    setRejectionReason('');
    setFetchingCard(true);

    try {
      const url = await verificationService.getCardUrl(request.id);
      setCardUrl(url);
    } catch (error: any) {
      console.error('Error fetching card URL:', error);
      toast.error('فشل في استرداد رابط صورة الهوية المهنية');
    } finally {
      setFetchingCard(false);
    }
  };

  const handleCloseReview = () => {
    if (submittingAction) return;
    setSelectedRequest(null);
    setCardUrl(null);
    setIsRejecting(false);
    setRejectionReason('');
  };

  const handleApprove = async (id: string) => {
    if (!confirm('هل أنت متأكد من قبول طلب هذا الطبيب؟ سيتم تفعيل حسابه وإنشاء ملف كاتب له تلقائياً.')) {
      return;
    }

    try {
      setSubmittingAction(true);
      const res = await verificationService.approve(id);
      toast.success(res.message || 'تم قبول طلب الطبيب وتفعيل ملفه المهني بنجاح');
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      console.error('Error approving doctor:', error);
      toast.error(error.message || 'فشل في إتمام عملية القبول');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      toast.error('يرجى تحديد سبب الرفض لمساعدة الطبيب');
      return;
    }

    try {
      setSubmittingAction(true);
      const res = await verificationService.reject(id, rejectionReason.trim());
      toast.success(res.message || 'تم رفض طلب التحقق بنجاح وإشعار الطبيب');
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      console.error('Error rejecting doctor:', error);
      toast.error(error.message || 'فشل في إتمام عملية الرفض');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-950 tracking-tight" data-testid="admin-verifications-title">
              طلبات التحقق من الهويات
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              مراجعة وتفعيل الحسابات المهنية للأطباء المنضمين حديثاً للمنصة
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
              <div className="h-20 bg-gray-50 rounded"></div>
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center flex flex-col items-center justify-center max-w-2xl mx-auto mt-8">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">لا توجد طلبات تحقق معلقة</h3>
            <p className="text-sm text-gray-500 mt-1.5 max-w-sm">
              جميع طلبات الانضمام للأطباء تمت معالجتها بالكامل. سيظهر هنا أي طبيب يسجل حساباً جديداً بانتظار تفعيلك.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden" data-testid="admin-verifications-table">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-6">الطبيب</th>
                    <th className="py-4 px-6">التخصص</th>
                    <th className="py-4 px-6">الخبرة</th>
                    <th className="py-4 px-6">تاريخ تقديم الطلب</th>
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
                        <div className="font-semibold text-gray-900">{req.display_name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{req.phone_number}</div>
                      </td>
                      <td className="py-4 px-6 text-gray-600">{req.specialization}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md text-xs font-medium border border-amber-100">
                          <Award className="w-3.5 h-3.5" />
                          {req.experience_years} {req.experience_years >= 11 ? 'سنة خبرة' : 'سنوات خبرة'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-500">
                        {new Date(req.created_at).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="py-4 px-6 text-left">
                        <button
                          onClick={() => handleOpenReview(req)}
                          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm shadow-blue-100 hover:shadow-md hover:shadow-blue-200"
                          data-testid={`review-button-${req.id}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          مراجعة المستندات
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-gray-100 flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
              
              {/* Doctor Details (Right Pane on desktop) */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto border-l border-gray-100 order-2 md:order-1">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
                      طلب انضمام طبيب
                    </span>
                    <h2 className="text-2xl font-bold text-gray-950 mt-2">{selectedRequest.display_name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">مُعرّف المستخدم: {selectedRequest.id}</p>
                  </div>
                  <button
                    onClick={handleCloseReview}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Bio */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      النبذة التعريفية
                    </h3>
                    <p className="text-sm text-gray-700 bg-gray-50/70 p-4 rounded-2xl border border-gray-100 leading-relaxed font-normal">
                      {selectedRequest.bio || 'لا توجد نبذة تعريفية.'}
                    </p>
                  </div>

                  {/* Field details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-gray-50 bg-gray-50/20">
                      <Briefcase className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-400">التخصص</div>
                        <div className="text-sm font-semibold text-gray-800">{selectedRequest.specialization}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-gray-50 bg-gray-50/20">
                      <Award className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-400">سنوات الخبرة</div>
                        <div className="text-sm font-semibold text-gray-800">{selectedRequest.experience_years} سنة</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-gray-50 bg-gray-50/20 sm:col-span-2">
                      <GraduationCap className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-400">التحصيل العلمي والشهادات</div>
                        <div className="text-sm font-semibold text-gray-800">{selectedRequest.education}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-gray-50 bg-gray-50/20 sm:col-span-2">
                      <MapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-400">عنوان العيادة / العمل</div>
                        <div className="text-sm font-semibold text-gray-800">{selectedRequest.clinic_address}</div>
                      </div>
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="border-t border-gray-100 pt-6 space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">معلومات الاتصال</h3>
                    
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{selectedRequest.phone_number}</span>
                    </div>

                    {selectedRequest.email && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <a href={`mailto:${selectedRequest.email}`} className="hover:text-blue-600 hover:underline">{selectedRequest.email}</a>
                      </div>
                    )}

                    {selectedRequest.website && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <a href={selectedRequest.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline flex items-center gap-1">
                          {selectedRequest.website}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Main Action Buttons */}
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
                        قبول واعتماد الطبيب
                      </button>

                      <button
                        onClick={() => setIsRejecting(true)}
                        disabled={submittingAction}
                        className="inline-flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 disabled:bg-gray-100 text-rose-600 disabled:text-gray-400 px-5 py-3 rounded-2xl text-sm font-bold transition-all"
                        data-testid="reject-button"
                      >
                        <X className="w-4 h-4" />
                        رفض الطلب
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 bg-rose-50/50 p-5 rounded-2xl border border-rose-100 animate-slide-up">
                      <div>
                        <label className="block text-xs font-bold text-rose-800 mb-2 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          سبب الرفض (سيظهر للطبيب في لوحة تحكمه):
                        </label>
                        <textarea
                          placeholder="مثال: صورة بطاقة النقابة غير واضحة، يرجى إعادة رفع صورة عالية الدقة أو كتابة الاسم الحقيقي..."
                          rows={3}
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="w-full border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-xl p-3 text-sm"
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
                          تأكيد رفض الطلب
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

              {/* Syndicate ID Card Image (Left Pane on desktop) */}
              <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-6 min-h-[300px] md:min-h-0 relative order-1 md:order-2">
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                  {cardUrl && (
                    <>
                      <a
                        href={cardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/95 backdrop-blur shadow-sm hover:shadow text-gray-700 rounded-full transition-all"
                        title="فتح في علامة تبويب جديدة"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <a
                        href={cardUrl}
                        download={`syndicate-card-${selectedRequest.id}`}
                        className="p-2 bg-white/95 backdrop-blur shadow-sm hover:shadow text-gray-700 rounded-full transition-all"
                        title="تحميل الصورة"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </>
                  )}
                </div>

                <div className="w-full text-center">
                  <h4 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">وثيقة إثبات الهوية / بطاقة النقابة</h4>
                  
                  {fetchingCard ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                      <p className="text-xs text-gray-400 mt-2">جاري استيراد الصورة بأمان...</p>
                    </div>
                  ) : cardUrl ? (
                    <div className="relative group rounded-2xl overflow-hidden border border-gray-200 shadow-sm max-h-[50vh] md:max-h-full flex items-center justify-center bg-white">
                      <img
                        src={cardUrl}
                        alt="بطاقة النقابة"
                        className="max-w-full max-h-[50vh] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-rose-500">
                      <X className="w-8 h-8 mb-2" />
                      <p className="text-xs font-semibold">فشل في تحميل المستند</p>
                      <p className="text-[11px] text-gray-400 mt-1">يرجى التأكد من صلاحيات الخادم أو إعادة محاولة التحميل</p>
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
