import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, Upload, Eye, FileText, Users, Calendar, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import RichTextEditor from '../editor/RichTextEditor';
import AuthorForm from './AuthorForm';
import { api } from '../../context/AuthContext';

interface ResearchFormProps {
  research?: ResearchData | null;
  isEditing?: boolean;
}

interface ResearchData {
  id: string;
  title?: string;
  abstract?: string;
  journal?: string;
  publication_date?: string;
  authors?: string[];
  is_featured?: boolean;
}

interface CreatedAuthor {
  id: string;
  name: string;
}

interface ErrorWithResponse {
  response?: {
    data?: {
      error?: string;
    };
  };
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
    is_featured: false,
  });
  const [researchFile, setResearchFile] = useState<File | null>(null);
  const [authorInput, setAuthorInput] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authors, setAuthors] = useState<{ id: string; name: string }[]>([]);
  const [loadingAuthors, setLoadingAuthors] = useState(true);
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState('');

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

  useEffect(() => {
    if (research && isEditing) {
      setFormData({
        title: research.title || '',
        abstract: research.abstract || '',
        journal: research.journal || '',
        publication_date: research.publication_date ? research.publication_date.split('T')[0] : '',
        authors: research.authors || [],
        is_featured: research.is_featured || false,
      });
    }
  }, [research, isEditing]);

  // Fetch authors on mount
  useEffect(() => {
    fetchAuthors();
  }, []);

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

  const addAuthorByName = (name: string) => {
    if (name && !formData.authors.includes(name)) {
      setFormData(prev => ({
        ...prev,
        authors: [...prev.authors, name]
      }));
      if (errors.authors) {
        setErrors(prev => ({ ...prev, authors: '' }));
      }
    }
  };

  const addAuthor = () => {
    const trimmed = authorInput.trim();
    if (!trimmed) return;
    const existing = authors.find(a => a.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      addAuthorByName(existing.name);
      setAuthorInput('');
      return;
    }
    setNewAuthorName(trimmed);
    setShowAuthorModal(true);
    setAuthorInput('');
  };

  const handleAuthorCreated = (createdAuthor: CreatedAuthor) => {
    if (createdAuthor?.name) {
      setAuthors(prev => {
        const exists = prev.some(a => a.id === createdAuthor.id);
        if (exists) return prev;
        return [...prev, { id: createdAuthor.id, name: createdAuthor.name }];
      });
      addAuthorByName(createdAuthor.name);
    }
    setShowAuthorModal(false);
    setNewAuthorName('');
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
      submitData.append('is_featured', formData.is_featured.toString());

      if (researchFile) {
        submitData.append('research_file', researchFile);
      }

      if (isEditing && research) {
        await api.put(`/admin/research/${research.id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post('/admin/research', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success(isEditing ? 'تم تحديث البحث بنجاح' : 'تم إنشاء البحث بنجاح');
      navigate('/research');
    } catch (error: unknown) {
      console.error('Error saving research:', error);
      const candidate = error as ErrorWithResponse;
      const errorMessage = candidate.response?.data?.error || 'حدث خطأ أثناء حفظ البحث';
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

            <div className="flex items-center mt-4">
              <input
                type="checkbox"
                id="is_featured"
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-colors cursor-pointer"
                checked={formData.is_featured}
                onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
              />
              <label htmlFor="is_featured" className="mr-3 font-medium text-gray-700 cursor-pointer">
                تمييز هذا البحث (إظهاره في قسم الأبحاث المميزة بالصفحة الرئيسية)
              </label>
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
            <div className="flex flex-col lg:flex-row gap-3">
              <select
                value={selectedAuthor}
                onChange={(e) => {
                  const name = e.target.value;
                  if (!name) return;
                  addAuthorByName(name);
                  setSelectedAuthor('');
                }}
                className="form-input flex-1"
                disabled={loadingAuthors}
              >
                <option value="">
                  {loadingAuthors ? 'جارٍ التحميل...' : 'اختر مؤلفاً من القائمة'}
                </option>
                {authors.map((author) => (
                  <option key={author.id} value={author.name}>
                    {author.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-500">يمكنك أيضاً إنشاء مؤلف جديد بتفاصيله</p>
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
                placeholder="أدخل اسم مؤلف جديد واضغط Enter"
              />
            </div>
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => {
                  const trimmed = authorInput.trim();
                  if (trimmed) {
                    setNewAuthorName(trimmed);
                  } else {
                    setNewAuthorName('');
                  }
                  setShowAuthorModal(true);
                  setAuthorInput('');
                }}
                className="btn-secondary"
              >
                إضافة مؤلف جديد بالتفاصيل
              </button>
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

      {/* Create Author Modal */}
      {showAuthorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">إضافة مؤلف جديد</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAuthorModal(false);
                  setNewAuthorName('');
                }}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <AuthorForm
                embedded
                initialName={newAuthorName}
                onSaved={handleAuthorCreated}
                onCancel={() => {
                  setShowAuthorModal(false);
                  setNewAuthorName('');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchForm;
