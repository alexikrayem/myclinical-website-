import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Upload, Video, BrainCircuit, ShieldAlert } from 'lucide-react';
import AdminLayout from '../components/layout/AdminLayout';
import { courseService } from '../services/courseService';
import toast from 'react-hot-toast';

const EditCourse: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        author: '',
        playback_source: '',
        playback_provider: 'vdocipher',
        billing_model: 'per_minute',
        minute_cost: 1,
        preview_source: '',
        preview_seconds: 0,
        transcript: '',
        credits_required: 0,
        duration: 0,
        categories: '',
        is_featured: false,
        attention_required: false
    });
    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchCourse = async () => {
            if (!id) return;
            try {
                const data = await courseService.getById(id);
                setFormData({
                    title: data.title,
                    description: data.description,
                    author: data.author,
                    playback_source: data.playback_source,
                    playback_provider: data.playback_provider || 'vdocipher',
                    billing_model: data.billing_model || 'per_minute',
                    minute_cost: data.minute_cost ?? 1,
                    preview_source: data.preview_source || '',
                    preview_seconds: data.preview_seconds || 0,
                    transcript: data.transcript || '',
                    credits_required: data.credits_required || 0,
                    duration: data.duration || 0,
                    categories: data.categories.join(', '),
                    is_featured: data.is_featured,
                    attention_required: data.attention_required || false
                });
                setPreviewUrl(data.cover_image);
            } catch (error) {
                console.error('Error fetching course:', error);
                toast.error('فشل تحميل بيانات الدورة');
                navigate('/courses');
            } finally {
                setFetching(false);
            }
        };

        fetchCourse();
    }, [id, navigate]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;

        setLoading(true);
        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('description', formData.description);
            data.append('author', formData.author);
            data.append('playback_source', formData.playback_source);
            data.append('playback_provider', formData.playback_provider);
            data.append('billing_model', formData.billing_model);
            data.append('minute_cost', formData.minute_cost.toString());
            data.append('preview_source', formData.preview_source);
            data.append('preview_seconds', formData.preview_seconds.toString());
            data.append('transcript', formData.transcript);
            data.append('credits_required', formData.credits_required.toString());
            data.append('duration', formData.duration.toString());
            data.append('categories', JSON.stringify(formData.categories.split(',').map(c => c.trim())));
            data.append('is_featured', formData.is_featured.toString());
            data.append('attention_required', formData.attention_required.toString());
            if (coverImage) {
                data.append('cover_image', coverImage);
            } else if (previewUrl) {
                data.append('cover_image_url', previewUrl);
            }

            await courseService.update(id, data);
            toast.success('تم تحديث الدورة بنجاح');
            navigate('/courses');
        } catch (error) {
            console.error('Error updating course:', error);
            toast.error('فشل تحديث الدورة');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/courses')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowRight size={24} className="text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">تعديل الدورة</h1>
                        <p className="text-gray-600">تعديل تفاصيل الدورة التدريبية</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Video className="text-blue-500" size={20} />
                            معلومات الدورة
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">عنوان الدورة</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">وصف الدورة</label>
                                <textarea
                                    required
                                    rows={4}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">المدرب</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    value={formData.author}
                                    onChange={e => setFormData({ ...formData, author: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">التصنيفات (مفصولة بفاصلة)</label>
                                <input
                                    type="text"
                                    placeholder="مثال: طب أسنان, جراحة, تقويم"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    value={formData.categories}
                                    onChange={e => setFormData({ ...formData, categories: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">مزود التشغيل</label>
                                <select
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    value={formData.playback_provider}
                                    onChange={e => setFormData({ ...formData, playback_provider: e.target.value })}
                                >
                                    <option value="vdocipher">VdoCipher</option>
                                    <option value="hls">HLS</option>
                                    <option value="youtube">YouTube</option>
                                    <option value="mp4">MP4</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">مصدر التشغيل</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="vdocipher-id أو رابط HLS/MP4/YouTube"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all dir-ltr"
                                    value={formData.playback_source}
                                    onChange={e => setFormData({ ...formData, playback_source: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">المدة (بالدقائق)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    value={formData.duration}
                                    onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">نموذج الفوترة</label>
                                <select
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    value={formData.billing_model}
                                    onChange={e => setFormData({ ...formData, billing_model: e.target.value })}
                                >
                                    <option value="per_minute">بالدقيقة</option>
                                    <option value="per_course">بالكورس</option>
                                    <option value="free">مجاني</option>
                                </select>
                            </div>

                            {formData.billing_model === 'per_minute' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">تكلفة الدقيقة</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                        value={formData.minute_cost}
                                        onChange={e => setFormData({ ...formData, minute_cost: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            )}

                            {formData.billing_model === 'per_course' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">الرصيد المطلوب</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                        value={formData.credits_required}
                                        onChange={e => setFormData({ ...formData, credits_required: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">مصدر المعاينة (اختياري)</label>
                                <input
                                    type="text"
                                    placeholder="رابط معاينة أو نفس المصدر"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all dir-ltr"
                                    value={formData.preview_source}
                                    onChange={e => setFormData({ ...formData, preview_source: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">مدة المعاينة (ثواني)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    value={formData.preview_seconds}
                                    onChange={e => setFormData({ ...formData, preview_seconds: parseInt(e.target.value) || 0 })}
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-8">
                                <input
                                    type="checkbox"
                                    id="is_featured"
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                    checked={formData.is_featured}
                                    onChange={e => setFormData({ ...formData, is_featured: e.target.checked })}
                                />
                                <label htmlFor="is_featured" className="text-sm font-medium text-gray-700 cursor-pointer">
                                    تمييز هذه الدورة (تظهر في الصفحة الرئيسية)
                                </label>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="attention_required"
                                    className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                                    checked={formData.attention_required}
                                    onChange={e => setFormData({ ...formData, attention_required: e.target.checked })}
                                />
                                <label htmlFor="attention_required" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-1.5">
                                    <ShieldAlert size={16} className="text-orange-500" />
                                    تفعيل التحقق من الانتباه
                                    <span className="text-xs text-gray-400 font-normal">(مطلوب لإصدار الشهادات)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <BrainCircuit className="text-purple-500" size={20} />
                            الذكاء الاصطناعي
                        </h2>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                نص الفيديو (Transcript)
                                <span className="text-xs text-gray-500 mr-2 font-normal">يستخدم لإنشاء الاختبار تلقائياً</span>
                            </label>
                            <textarea
                                rows={10}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-mono text-sm"
                                placeholder="أدخل نص الفيديو هنا..."
                                value={formData.transcript}
                                onChange={e => setFormData({ ...formData, transcript: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Upload className="text-green-500" size={20} />
                            صورة الغلاف
                        </h2>

                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {previewUrl ? (
                                <div className="relative h-48 w-full">
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="h-full w-full object-contain rounded-lg"
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <Upload size={40} className="text-gray-400 mb-4" />
                                    <p className="text-gray-600 font-medium">اضغط لرفع صورة</p>
                                    <p className="text-sm text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/courses')}
                            className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    جاري الحفظ...
                                </>
                            ) : (
                                'حفظ التعديلات'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
};

export default EditCourse;
