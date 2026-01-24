import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Video, Star, BrainCircuit } from 'lucide-react';
import AdminLayout from '../components/layout/AdminLayout';
import { courseService, Course } from '../services/courseService';
import toast from 'react-hot-toast';

const Courses: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchCourses = async () => {
        try {
            const data = await courseService.getAll({ search: searchQuery });
            setCourses(data.data || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
            toast.error('فشل تحميل الدورات');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchCourses();
        }, 500);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    const handleDelete = async (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الدورة؟')) {
            try {
                await courseService.delete(id);
                setCourses(courses.filter(course => course.id !== id));
                toast.success('تم حذف الدورة بنجاح');
            } catch (error) {
                toast.error('فشل حذف الدورة');
            }
        }
    };

    const handleGenerateQuiz = async (id: string) => {
        const toastId = toast.loading('جاري إنشاء الاختبار...');
        try {
            await courseService.generateQuiz(id);
            toast.success('تم إنشاء الاختبار بنجاح', { id: toastId });
        } catch (error) {
            toast.error('فشل إنشاء الاختبار', { id: toastId });
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">الدورات التدريبية</h1>
                        <p className="text-gray-600">إدارة الدورات ومحتوى الفيديو</p>
                    </div>
                    <Link
                        to="/courses/create"
                        className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} />
                        <span>إضافة دورة جديدة</span>
                    </Link>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="بحث في الدورات..."
                                className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-600 text-sm font-medium">
                                <tr>
                                    <th className="px-6 py-4">الدورة</th>
                                    <th className="px-6 py-4">المدرب</th>
                                    <th className="px-6 py-4">التكلفة</th>
                                    <th className="px-6 py-4">الحالة</th>
                                    <th className="px-6 py-4">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            جاري التحميل...
                                        </td>
                                    </tr>
                                ) : courses.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            لا توجد دورات
                                        </td>
                                    </tr>
                                ) : (
                                    courses.map((course) => (
                                        <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                                        {course.cover_image ? (
                                                            <img src={course.cover_image} alt={course.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Video className="text-gray-400" size={20} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium text-gray-900 line-clamp-1">{course.title}</h3>
                                                        <div className="flex gap-1 mt-1">
                                                            {course.categories.slice(0, 2).map((cat, i) => (
                                                                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                    {cat}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {course.author}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2.5 py-1 rounded-full text-xs font-medium">
                                                    {course.credits_required} رصيد
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {course.is_featured && (
                                                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-xs font-medium">
                                                        <Star size={12} />
                                                        مميز
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleGenerateQuiz(course.id)}
                                                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                        title="إنشاء اختبار بالذكاء الاصطناعي"
                                                    >
                                                        <BrainCircuit size={18} />
                                                    </button>
                                                    <Link
                                                        to={`/courses/edit/${course.id}`}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="تعديل"
                                                    >
                                                        <Edit size={18} />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(course.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="حذف"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default Courses;
