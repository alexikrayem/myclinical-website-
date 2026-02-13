import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, Upload, Link as LinkIcon, Eye, Image, FileText, User, Tag, Star, Coins, Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import RichTextEditor from '../editor/RichTextEditor';
import { api } from '../../context/AuthContext';

interface ArticleFormProps {
  article?: any;
  isEditing?: boolean;
}

const ArticleForm: React.FC<ArticleFormProps> = ({ article, isEditing = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    content: '',
    author: '',
    tags: [] as string[],
    is_featured: false,
    cover_image_url: '',
    article_type: 'article', // Default type
    credits_required: 0,
  });
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [useImageUrl, setUseImageUrl] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authors, setAuthors] = useState<{ id: string; name: string }[]>([]);
  const [loadingAuthors, setLoadingAuthors] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);

  // Fetch authors on mount
  useEffect(() => {
    const fetchAuthors = async () => {
      try {
        const response = await api.get('/authors');
        setAuthors(response.data || []);
      } catch (error) {
        console.error('Error fetching authors:', error);
        toast.error('فشل في تحميل قائمة المؤلفين');
      } finally {
        setLoadingAuthors(false);
      }
    };
    fetchAuthors();
  }, []);

  // Fetch available tags/categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/admin/categories');
        // Map response objects to just names if needed, or handle icons/colors
        const categoryNames = response.data.map((cat: any) => cat.name_ar || cat.name);
        setCategories(categoryNames);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (article && isEditing) {
      setFormData({
        title: article.title || '',
        excerpt: article.excerpt || '',
        content: article.content || '',
        author: article.author || '',
        tags: article.tags || [],
        is_featured: article.is_featured || false,
        cover_image_url: article.cover_image || '',
        article_type: article.article_type || 'article',
        credits_required: article.credits_required || 0,
      });
      setUseImageUrl(article.cover_image && !article.cover_image.startsWith('/uploads/'));
    }
  }, [article, isEditing]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'عنوان المقال مطلوب';
    }

    if (!formData.author.trim()) {
      newErrors.author = 'اسم المؤلف مطلوب';
    }

    if (!formData.excerpt.trim()) {
      newErrors.excerpt = 'مقدمة المقال مطلوبة';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'محتوى المقال مطلوب';
    }

    if (formData.tags.length === 0) {
      newErrors.tags = 'يجب إضافة علامة واحدة على الأقل';
    }

    if (!useImageUrl && !coverImageFile && !isEditing) {
      newErrors.cover_image = 'صورة الغلاف مطلوبة';
    }

    if (useImageUrl && !formData.cover_image_url.trim()) {
      newErrors.cover_image_url = 'رابط صورة الغلاف مطلوب';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleContentChange = (content: string) => {
    setFormData(prev => ({ ...prev, content }));
    if (errors.content) {
      setErrors(prev => ({ ...prev, content: '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      if (errors.cover_image) {
        setErrors(prev => ({ ...prev, cover_image: '' }));
      }
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
      if (errors.tags) {
        setErrors(prev => ({ ...prev, tags: '' }));
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSuggestTags = async () => {
    if (!formData.title && !formData.content) {
      toast.error('يرجى إدخال العنوان أو المحتوى أولاً للحصول على اقتراحات');
      return;
    }

    try {
      setIsSuggestingTags(true);
      const response = await api.post('/ai/suggest-tags', {
        title: formData.title,
        excerpt: formData.excerpt,
        content: formData.content
      });

      if (response.data.success && response.data.tags) {
        const suggestedTags = response.data.tags;

        // Merge suggested tags with existing ones, avoiding duplicates
        const newTags = [...new Set([...formData.tags, ...suggestedTags])];

        setFormData(prev => ({
          ...prev,
          tags: newTags
        }));

        toast.success('تم تحديث العلامات بناءً على اقتراحات الذكاء الاصطناعي');
      }
    } catch (error) {
      console.error('Error suggesting tags:', error);
      toast.error('فشل في الحصول على اقتراحات للعلامات');
    } finally {
      setIsSuggestingTags(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('يرجى تصحيح الأخطاء في النموذج');
      return;
    }

    try {
      setLoading(true);

      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('excerpt', formData.excerpt);
      submitData.append('content', formData.content);
      submitData.append('author', formData.author);

      submitData.append('tags', JSON.stringify(formData.tags));
      submitData.append('is_featured', formData.is_featured.toString());
      submitData.append('article_type', formData.article_type);
      submitData.append('credits_required', formData.credits_required.toString());

      if (useImageUrl) {
        submitData.append('cover_image_url', formData.cover_image_url);
      } else if (coverImageFile) {
        submitData.append('cover_image', coverImageFile);
      }

      let response;
      if (isEditing && article) {
        response = await api.put(`/admin/articles/${article.id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await api.post('/admin/articles', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success(isEditing ? 'تم تحديث المقال بنجاح' : 'تم إنشاء المقال بنجاح');
      navigate('/articles');
    } catch (error: any) {
      console.error('Error saving article:', error);
      const errorMessage = error.response?.data?.error || 'حدث خطأ أثناء حفظ المقال';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (previewMode) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">معاينة المقال</h1>
          <button
            onClick={() => setPreviewMode(false)}
            className="btn-secondary"
          >
            <X size={20} className="ml-2" />
            إغلاق المعاينة
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            {(formData.cover_image_url || coverImageFile) && (
              <div className="image-preview mb-6">
                <img
                  src={formData.cover_image_url || (coverImageFile ? URL.createObjectURL(coverImageFile) : '')}
                  alt={formData.title}
                  className="w-full h-64 object-cover rounded-xl"
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span key={index} className="badge badge-primary">
                    {tag}
                  </span>
                ))}
                {formData.is_featured && (
                  <span className="badge badge-featured">
                    <Star size={12} className="ml-1" />
                    مقال مميز
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-bold text-gray-900">{formData.title}</h1>

              <div className="flex items-center text-gray-600">
                <User size={16} className="ml-2" />
                <span>{formData.author}</span>
              </div>

              <div className="text-lg text-gray-700 bg-blue-50 p-4 rounded-xl border-r-4 border-blue-500">
                {formData.excerpt}
              </div>

              <div
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: formData.content }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? 'تعديل المقال' : 'إضافة مقال جديد'}
        </h1>
        <div className="flex space-x-3 space-x-reverse">
          <button
            type="button"
            onClick={() => setPreviewMode(true)}
            className="btn-secondary"
          >
            <Eye size={20} className="ml-2" />
            معاينة
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="form-section">
          <div className="form-section-title">
            <FileText size={20} className="inline ml-2" />
            المعلومات الأساسية
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="form-label">عنوان المقال *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`form-input ${errors.title ? 'border-red-500' : ''}`}
                placeholder="أدخل عنوان المقال"
              />
              {errors.title && <p className="form-error">{errors.title}</p>}
            </div>

            <div>
              <label className="form-label">المؤلف *</label>
              <select
                name="author"
                value={formData.author}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, author: e.target.value }));
                  if (errors.author) {
                    setErrors(prev => ({ ...prev, author: '' }));
                  }
                }}
                className={`form-input ${errors.author ? 'border-red-500' : ''}`}
                disabled={loadingAuthors}
              >
                <option value="">
                  {loadingAuthors ? 'جارٍ التحميل...' : 'اختر المؤلف'}
                </option>
                {authors.map((author) => (
                  <option key={author.id} value={author.name}>
                    {author.name}
                  </option>
                ))}
              </select>
              {errors.author && <p className="form-error">{errors.author}</p>}
            </div>
          </div>

          <div>
            <label className="form-label">مقدمة المقال *</label>
            <textarea
              name="excerpt"
              value={formData.excerpt}
              onChange={handleInputChange}
              rows={3}
              className={`form-textarea ${errors.excerpt ? 'border-red-500' : ''}`}
              placeholder="أدخل مقدمة المقال"
            />
            {errors.excerpt && <p className="form-error">{errors.excerpt}</p>}
          </div>
        </div>

        {/* Content */}
        <div className="form-section">
          <div className="form-section-title">
            <FileText size={20} className="inline ml-2" />
            محتوى المقال
          </div>

          <div>
            <label className="form-label">المحتوى *</label>
            <div className={`rich-editor ${errors.content ? 'border-red-500' : ''}`}>
              <RichTextEditor
                value={formData.content}
                onChange={handleContentChange}
                height="400px"
                placeholder="اكتب محتوى المقال هنا..."
              />
            </div>
            {errors.content && <p className="form-error">{errors.content}</p>}
          </div>
        </div>

        {/* Cover Image */}
        <div className="form-section">
          <div className="form-section-title">
            <Image size={20} className="inline ml-2" />
            صورة الغلاف
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-6 space-x-reverse">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!useImageUrl}
                  onChange={() => setUseImageUrl(false)}
                  className="ml-2"
                />
                <Upload size={16} className="ml-1" />
                رفع ملف
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={useImageUrl}
                  onChange={() => setUseImageUrl(true)}
                  className="ml-2"
                />
                <LinkIcon size={16} className="ml-1" />
                رابط صورة
              </label>
            </div>

            {useImageUrl ? (
              <div>
                <input
                  type="url"
                  name="cover_image_url"
                  value={formData.cover_image_url}
                  onChange={handleInputChange}
                  className={`form-input ${errors.cover_image_url ? 'border-red-500' : ''}`}
                  placeholder="أدخل رابط الصورة"
                />
                {errors.cover_image_url && <p className="form-error">{errors.cover_image_url}</p>}
              </div>
            ) : (
              <div className="file-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="cover-image-upload"
                />
                <label htmlFor="cover-image-upload" className="cursor-pointer">
                  <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-semibold text-gray-700 mb-2">
                    اختر صورة الغلاف
                  </p>
                  <p className="text-sm text-gray-500">
                    PNG, JPG, GIF حتى 5MB
                  </p>
                </label>
                {coverImageFile && (
                  <p className="mt-2 text-sm text-green-600">
                    تم اختيار: {coverImageFile.name}
                  </p>
                )}
                {errors.cover_image && <p className="form-error">{errors.cover_image}</p>}
              </div>
            )}

            {(formData.cover_image_url || coverImageFile) && (
              <div className="image-preview">
                <img
                  src={formData.cover_image_url || (coverImageFile ? URL.createObjectURL(coverImageFile) : '')}
                  alt="معاينة صورة الغلاف"
                />
                <div className="image-preview-overlay">
                  <p className="text-white font-semibold">معاينة صورة الغلاف</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tags and Settings */}
        <div className="form-section">
          <div className="form-section-title flex justify-between items-center">
            <div className="flex items-center">
              <Tag size={20} className="ml-2" />
              العلامات والإعدادات
            </div>
            <button
              type="button"
              onClick={handleSuggestTags}
              disabled={isSuggestingTags || loadingCategories}
              className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-bold flex items-center hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {isSuggestingTags ? (
                <>
                  <Loader2 size={16} className="ml-2 animate-spin" />
                  جاري الاقتراح...
                </>
              ) : (
                <>
                  <Sparkles size={16} className="ml-2" />
                  اقتراح علامات بالذكاء الاصطناعي
                </>
              )}
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="form-label">التصنيفات *</label>
              {loadingCategories ? (
                <p className="text-gray-500 text-sm">جارٍ تحميل التصنيفات...</p>
              ) : categories.length === 0 ? (
                <p className="text-gray-500 text-sm">لا توجد تصنيفات متاحة</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 border rounded-lg bg-gray-50">
                  {categories.map((category) => (
                    <label
                      key={category}
                      className={`flex items-center p-2 rounded-lg cursor-pointer transition-all ${formData.tags.includes(category)
                        ? 'bg-blue-100 border-blue-500 border-2'
                        : 'bg-white border border-gray-200 hover:border-blue-300'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.tags.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              tags: [...prev.tags, category]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              tags: prev.tags.filter(t => t !== category)
                            }));
                          }
                          if (errors.tags) {
                            setErrors(prev => ({ ...prev, tags: '' }));
                          }
                        }}
                        className="ml-2 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
              )}
              {formData.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-sm text-gray-600">المختارة:</span>
                  {formData.tags.map((tag) => (
                    <span key={tag} className="tag-item">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          tags: prev.tags.filter(t => t !== tag)
                        }))}
                        className="tag-remove"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {errors.tags && <p className="form-error">{errors.tags}</p>}
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_featured"
                checked={formData.is_featured}
                onChange={handleInputChange}
                className="ml-3 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label className="flex items-center text-sm font-semibold text-gray-700">
                <Star size={16} className="ml-2 text-yellow-500" />
                مقال مميز
              </label>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <label className="form-label flex items-center">
                <Coins size={18} className="ml-2 text-blue-500" />
                الرصيد المطلوب للقراءة *
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  name="credits_required"
                  value={formData.credits_required}
                  onChange={handleInputChange}
                  min="0"
                  className="form-input w-32"
                />
                <span className="text-sm text-gray-500">
                  (0 يعني أن المقال متاح لجميع الأعضاء المسجلين مجاناً)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 space-x-reverse pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/articles')}
            className="btn-secondary"
          >
            <X size={20} className="ml-2" />
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            <Save size={20} className="ml-2" />
            {loading ? 'جاري الحفظ...' : (isEditing ? 'تحديث المقال' : 'نشر المقال')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ArticleForm;
