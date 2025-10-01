import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, Upload, Link as LinkIcon, Eye, Image, FileText, User, Tag, Star } from 'lucide-react';
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
  });
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [useImageUrl, setUseImageUrl] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
              <input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                className={`form-input ${errors.author ? 'border-red-500' : ''}`}
                placeholder="أدخل اسم المؤلف"
              />
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
          <div className="form-section-title">
            <Tag size={20} className="inline ml-2" />
            العلامات والإعدادات
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="form-label">العلامات *</label>
              <div className="tag-input">
                {formData.tags.map((tag, index) => (
                  <span key={index} className="tag-item">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="tag-remove"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 min-w-0 border-none outline-none bg-transparent"
                  placeholder="أضف علامة واضغط Enter"
                />
              </div>
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
