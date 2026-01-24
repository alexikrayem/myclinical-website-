import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../components/layout/AdminLayout';
import { api } from '../context/AuthContext';

interface Category {
    id: string;
    name: string;
    name_ar: string | null;
    description: string | null;
    color: string;
    is_active: boolean;
    created_at: string;
}

const Categories: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        name_ar: '',
        description: '',
        color: '#3B82F6',
        is_active: true
    });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await api.get('/admin/categories');
            setCategories(response.data || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
            toast.error('فشل في تحميل التصنيفات');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error('اسم التصنيف مطلوب');
            return;
        }

        try {
            if (editingCategory) {
                await api.put(`/admin/categories/${editingCategory.id}`, formData);
                toast.success('تم تحديث التصنيف بنجاح');
            } else {
                await api.post('/admin/categories', formData);
                toast.success('تم إنشاء التصنيف بنجاح');
            }

            resetForm();
            fetchCategories();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'فشل في حفظ التصنيف');
        }
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            name_ar: category.name_ar || '',
            description: category.description || '',
            color: category.color,
            is_active: category.is_active
        });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا التصنيف؟')) return;

        try {
            await api.delete(`/admin/categories/${id}`);
            toast.success('تم حذف التصنيف بنجاح');
            fetchCategories();
        } catch (error) {
            toast.error('فشل في حذف التصنيف');
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingCategory(null);
        setFormData({
            name: '',
            name_ar: '',
            description: '',
            color: '#3B82F6',
            is_active: true
        });
    };

    const colorPresets = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
    ];

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#005CB9]"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">إدارة التصنيفات</h1>
                        <p className="text-gray-600">إدارة تصنيفات المقالات</p>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} />
                        إضافة تصنيف
                    </button>
                </div>

                {/* Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">
                                    {editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
                                </h2>
                                <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        اسم التصنيف (بالإنجليزية) *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="e.g., Dental Implants"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        اسم التصنيف (بالعربية)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name_ar}
                                        onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="مثال: زراعة الأسنان"
                                        dir="rtl"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        الوصف
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        rows={2}
                                        placeholder="وصف مختصر للتصنيف"
                                        dir="rtl"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        اللون
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        {colorPresets.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color })}
                                                className={`w-8 h-8 rounded-lg transition-transform ${formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="is_active" className="text-sm text-gray-700">
                                        تصنيف نشط
                                    </label>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        {editingCategory ? 'تحديث' : 'إضافة'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Categories Grid */}
                {categories.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                        <Tag size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-600">لا توجد تصنيفات</h3>
                        <p className="text-gray-500 mb-4">ابدأ بإضافة تصنيفات جديدة</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            إضافة تصنيف جديد
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map((category) => (
                            <div
                                key={category.id}
                                className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: category.color + '20' }}
                                        >
                                            <Tag size={20} style={{ color: category.color }} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-800">{category.name}</h3>
                                            {category.name_ar && (
                                                <p className="text-sm text-gray-500" dir="rtl">{category.name_ar}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {category.is_active ? (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                نشط
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                                غير نشط
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {category.description && (
                                    <p className="text-sm text-gray-600 mt-2 line-clamp-2" dir="rtl">
                                        {category.description}
                                    </p>
                                )}

                                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                                    <button
                                        onClick={() => handleEdit(category)}
                                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                                    >
                                        <Edit2 size={16} />
                                        تعديل
                                    </button>
                                    <button
                                        onClick={() => handleDelete(category.id)}
                                        className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                                    >
                                        <Trash2 size={16} />
                                        حذف
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default Categories;
