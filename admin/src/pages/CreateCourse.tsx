import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Upload, Video, FileText, BrainCircuit } from 'lucide-react';
import AdminLayout from '../components/layout/AdminLayout';
import { courseService } from '../services/courseService';
import toast from 'react-hot-toast';

const CreateCourse: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        author: '',
        video_url: '',
        transcript: '',
        credits_required: 100,
        duration: 0,
        categories: '',
        is_featured: false
    });
    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!coverImage) {
            toast.error('يرجى اختيار صورة غلاف للدورة');
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('description', formData.description);
            data.append('author', formData.author);
            data.append('video_url', formData.video_url);
            data.append('transcript', formData.transcript);
            data.append('credits_required', formData.credits_required.toString());
            data.append('duration', formData.duration.toString());
            data.append('categories', JSON.stringify(formData.categories.split(',').map(c => c.trim())));
            data.append('is_featured', formData.is_featured.toString());
            data.append('cover_image', coverImage);

            await courseService.create(data);
            toast.success('تم إنشاء الدورة بنجاح');
            navigate('/courses');
        } catch (error) {
            console.error('Error creating course:', error);
            toast.error('فشل إنشاء الدورة');
        } finally {
            setLoading(false);
        }
    };

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
                        <h1 className="text-2xl font-bold text-gray-900">إضافة دورة جديدة</h1>
                        <p className="text-gray-600">أدخل تفاصيل الدورة التدريبية</p>
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">رابط الفيديو (YouTube)</label>
                                <input
                                    type="url"
                                    required
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all dir-ltr"
                                    value={formData.video_url}
                                    onChange={e => setFormData({ ...formData, video_url: e.target.value })}
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">الرصيد المطلوب</label>
                                <input
                                    type="number"
                                    min="0"
                                    required
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                    value={formData.credits_required}
                                    onChange={e => setFormData({ ...formData, credits_required: parseInt(e.target.value) })}
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
                                'حفظ الدورة'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
};

export default CreateCourse;
