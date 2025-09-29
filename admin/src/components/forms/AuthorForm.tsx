import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, Upload, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../context/AuthContext';

interface AuthorFormProps {
  author?: any;
  isEditing?: boolean;
}

const AuthorForm: React.FC<AuthorFormProps> = ({ author, isEditing = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    specialization: '',
    experience_years: 1,
    education: '',
    location: '',
    email: '',
    website: '',
    is_active: true,
    image_url: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [useImageUrl, setUseImageUrl] = useState(false);

  useEffect(() => {
    if (author && isEditing) {
      setFormData({
        name: author.name || '',
        bio: author.bio || '',
        specialization: author.specialization || '',
        experience_years: author.experience_years || 1,
        education: author.education || '',
        location: author.location || '',
        email: author.email || '',
        website: author.website || '',
        is_active: author.is_active !== false,
        image_url: author.image || '',
      });
      setUseImageUrl(author.image && !author.image.startsWith('/uploads/'));
    }
  }, [author, isEditing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
               type === 'number' ? parseInt(value) || 1 : value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.bio || !formData.specialization || !formData.education || !formData.location) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (!useImageUrl && !imageFile && !isEditing) {
      toast.error('يرجى اختيار صورة المؤلف');
      return;
    }

    if (useImageUrl && !formData.image_url) {
      toast.error('يرجى إدخال رابط صورة المؤلف');
      return;
    }

    try {
      setLoading(true);
      
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('bio', formData.bio);
      submitData.append('specialization', formData.specialization);
      submitData.append('experience_years', formData.experience_years.toString());
      submitData.append('education', formData.education);
      submitData.append('location', formData.location);
      submitData.append('email', formData.email);
      submitData.append('website', formData.website);
      submitData.append('is_active', formData.is_active.toString());

      if (useImageUrl) {
        submitData.append('image_url', formData.image_url);
      } else if (imageFile) {
        submitData.append('image', imageFile);
      }

      let response;
      if (isEditing && author) {
        response = await api.put(`/admin/authors/${author.id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await api.post('/admin/authors', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success(isEditing ? 'تم تحديث المؤلف بنجاح' : 'تم إنشاء المؤلف بنجاح');
      navigate('/authors');
    } catch (error: any) {
      console.error('Error saving author:', error);
      const errorMessage = error.response?.data?.error || 'حدث خطأ أثناء حفظ المؤلف';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? 'تعديل المؤلف' : 'إضافة مؤلف جديد'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            اسم المؤلف *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005CB9]"
            placeholder="أدخل اسم المؤلف"
            required
          />
        </div>

        {/* Specialization */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            التخصص *
          </label>
          <input
            type="text"
            name="specialization"
            value={formData.specialization}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005CB9]"
            placeholder="أدخل التخصص"
            required
          />
        </div>

        {/* Experience Years */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            سنوات الخبرة *
          </label>
          <input
            type="number"
            name="experience_years"
            value={formData.experience_years}
            onChange={handleInputChange}
            min="1"
            max="50"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005CB9]"
            required
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            نبذة عن المؤلف *
          </label>
          <textarea
            name="bio"
            value={formData.bio}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005CB9]"
            placeholder="أدخل نبذة عن المؤلف"
            required
          />
        </div>

        {/* Education */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            المؤهلات العلمية *
          </label>
          <textarea
            name="education"
            value={formData.education}
            onChange={handleInputChange}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005CB9]"
            placeholder="أدخل المؤهلات العلمية"
            required
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            الموقع *
          </label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005CB9]"
            placeholder="أدخل الموقع"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            البريد الإلكتروني
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005CB9]"
            placeholder="أدخل البريد الإلكتروني"
          />
        </div>

        {/* Website */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            الموقع الإلكتروني
          </label>
          <input
            type="url"
            name="website"
            value={formData.website}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005CB9]"
            placeholder="أدخل الموقع الإلكتروني"
          />
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            صورة المؤلف *
          </label>
          
          <div className="flex items-center space-x-4 space-x-reverse mb-4">
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
            <input
              type="url"
              name="image_url"
              value={formData.image_url}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005CB9]"
              placeholder="أدخل رابط الصورة"
            />
          ) : (
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005CB9]"
            />
          )}
        </div>

        {/* Active Status */}
        <div className="flex items-center">
          <input
            type="checkbox"
            name="is_active"
            checked={formData.is_active}
            onChange={handleInputChange}
            className="ml-2"
          />
          <label className="text-sm font-medium text-gray-700">
            مؤلف نشط
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 space-x-reverse pt-6 border-t">
          <button
            type="button"
            onClick={() => navigate('/authors')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center px-6 py-2 bg-[#005CB9] text-white rounded-md hover:bg-[#0047A0] transition-colors disabled:opacity-50"
          >
            <Save size={16} className="ml-2" />
            {loading ? 'جاري الحفظ...' : (isEditing ? 'تحديث' : 'حفظ')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AuthorForm;