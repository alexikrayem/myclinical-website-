import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, Upload, Eye, FileText, Users, Calendar, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import RichTextEditor from '../editor/RichTextEditor';
import { api } from '../../context/AuthContext';

interface ResearchFormProps {
  research?: any;
  isEditing?: boolean;
}

const ResearchForm: React.FC<ResearchFormProps> = ({ research, isEditing = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    abstract: '',
    journal: '',
    publication_date: '',
    authors: [] as string[],
  });
  const [researchFile, setResearchFile] = useState<File | null>(null);
  const [authorInput, setAuthorInput] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (research && isEditing) {
      setFormData({
        title: research.title || '',
        abstract: research.abstract || '',
        journal: research.journal || '',
        publication_date: research.publication_date ? research.publication_date.split('T')[0] : '',
        authors: research.authors || [],
      });
    }
  }, [research, isEditing]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'عنوان البحث مطلوب';
    }

    if (!formData.abstract.trim()) {
      newErrors.abstract = 'ملخص البحث مطلوب';
    }

    if (!formData.journal.trim()) {
      newErrors.journal = 'اسم المجلة العلمية مطلوب';
    }

    if (!formData.publication_date) {
      newErrors.publication_date = 'تاريخ النشر مطلوب';
    }

    if (formData.authors.length === 0) {
      newErrors.authors = 'يجب إضافة مؤلف واحد على الأقل';
    }

    if (!researchFile && !isEditing) {
      newErrors.research_file = 'ملف البحث مطلوب';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAbstractChange = (abstract: string) => {
    setFormData(prev => ({ ...prev, abstract }));
    if (errors.abstract) {
      setErrors(prev => ({ ...prev, abstract: '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResearchFile(file);
      if (errors.research_file) {
        setErrors(prev => ({ ...prev, research_file: '' }));
      }
    }
  };

  const addAuthor = () => {
    if (authorInput.trim() && !formData.authors.includes(authorInput.trim())) {
      setFormData(prev => ({
        ...prev,
        authors: [...prev.authors, authorInput.trim()]
      }));
      setAuthorInput('');
      if (errors.authors) {
        setErrors(prev => ({ ...prev, authors: '' }));
      }
    }
  };

  const removeAuthor = (authorToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      authors: prev.authors.filter(author => author !== authorToRemove)
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
      submitData.append('abstract', formData.abstract);
      submitData.append('journal', formData.journal);
      submitData.append('publication_date', formData.publication_date);
      submitData.append('authors', JSON.stringify(formData.authors));

      if (researchFile) {
        submitData.append('research_file', researchFile);
      }

      let response;
      if (isEditing && research) {
        response = await api.put(`/admin/research/${research.id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await api.post('/admin/research', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success(isEditing ? 'تم تحديث البحث بنجاح' : 'تم إنشاء البحث بنجاح');
      navigate('/research');
    } catch (error: any) {
      console.error('Error saving research:', error);
      const errorMessage = error.response?.data?.error || 'حدث خطأ أثناء حفظ البحث';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (previewMode) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">معاينة البحث</h1>
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
            <div className="space-y-6">
              <div>
                <span className="badge badge-primary mb-4">بحث علمي محكم</span>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">{formData.title}</h1>
                
                <div className="flex items-center text-gray-600 mb-4">
                  <BookOpen size={16} className="ml-2" />
                  <span className="font-semibold">{formData.journal}</span>
                </div>

                <div className="flex items-center text-gray-600 mb-6">
                  <Calendar size={16} className="ml-2" />
                  <span>{new Date(formData.publication_date).toLocaleDateString('ar-SA')}</span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Users size={18} className="ml-2" />
                  المؤلفون
                </h3>
                <div className="flex flex-wrap gap-2">
                  {formData.authors.map((author, index) => (
                    <span key={index} className="badge badge-success">
                      {author}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">ملخص البحث</h3>
                <div 
                  className="prose prose-lg max-w-none bg-gray-50 p-6 rounded-xl"
                  dangerouslySetInnerHTML={{ __html: formData.abstract }} 
                />
              </div>

              {researchFile && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <div className="flex items-center">
                    <FileText size={20} className="text-blue-600 ml-2" />
                    <span className="font-semibold text-blue-800">ملف البحث: {researchFile.name}</span>
                  </div>
                </div>
              )}
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
          {isEditing ? 'تعديل البحث' : 'إضافة بحث جديد'}
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
          
          <div className="space-y-6">
            <div>
              <label className="form-label">عنوان البحث *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`form-input ${errors.title ? 'border-red-500' : ''}`}
                placeholder="أدخل عنوان البحث"
              />
              {errors.title && <p className="form-error">{errors.title}</p>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="form-label">المجلة العلمية *</label>
                <input
                  type="text"
                  name="journal"
                  value={formData.journal}
                  onChange={handleInputChange}
                  className={`form-input ${errors.journal ? 'border-red-500' : ''}`}
                  placeholder="أدخل اسم المجلة العلمية"
                />
                {errors.journal && <p className="form-error">{errors.journal}</p>}
              </div>

              <div>
                <label className="form-label">تاريخ النشر *</label>
                <input
                  type="date"
                  name="publication_date"
                  value={formData.publication_date}
                  onChange={handleInputChange}
                  className={`form-input ${errors.publication_date ? 'border-red-500' : ''}`}
                />
                {errors.publication_date && <p className="form-error">{errors.publication_date}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Authors */}
        <div className="form-section">
          <div className="form-section-title">
            <Users size={20} className="inline ml-2" />
            المؤلفون
          </div>
          
          <div className="space-y-4">
            <div className="tag-input">
              {formData.authors.map((author, index) => (
                <span key={index} className="tag-item">
                  {author}
                  <button
                    type="button"
                    onClick={() => removeAuthor(author)}
                    className="tag-remove"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAuthor())}
                className="flex-1 min-w-0 border-none outline-none bg-transparent"
                placeholder="أضف اسم المؤلف واضغط Enter"
              />
            </div>
            {errors.authors && <p className="form-error">{errors.authors}</p>}
          </div>
        </div>

        {/* Abstract */}
        <div className="form-section">
          <div className="form-section-title">
            <FileText size={20} className="inline ml-2" />
            ملخص البحث
          </div>
          
          <div>
            <label className="form-label">الملخص *</label>
            <div className={`rich-editor ${errors.abstract ? 'border-red-500' : ''}`}>
              <RichTextEditor
                value={formData.abstract}
                onChange={handleAbstractChange}
                height="300px"
                placeholder="اكتب ملخص البحث هنا..."
              />
            </div>
            {errors.abstract && <p className="form-error">{errors.abstract}</p>}
          </div>
        </div>

        {/* Research File */}
        <div className="form-section">
          <div className="form-section-title">
            <Upload size={20} className="inline ml-2" />
            ملف البحث
          </div>
          
          <div className="space-y-4">
            <div className="file-upload">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="research-file-upload"
              />
              <label htmlFor="research-file-upload" className="cursor-pointer">
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-semibold text-gray-700 mb-2">
                  {isEditing ? 'تحديث ملف البحث (اختياري)' : 'اختر ملف البحث'}
                </p>
                <p className="text-sm text-gray-500">
                  PDF, DOC, DOCX حتى 5MB
                </p>
              </label>
              {researchFile && (
                <p className="mt-2 text-sm text-green-600">
                  تم اختيار: {researchFile.name}
                </p>
              )}
              {errors.research_file && <p className="form-error">{errors.research_file}</p>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 space-x-reverse pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/research')}
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
            {loading ? 'جاري الحفظ...' : (isEditing ? 'تحديث البحث' : 'نشر البحث')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ResearchForm;