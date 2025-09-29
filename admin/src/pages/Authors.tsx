import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Search, X, User, Mail, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../components/layout/AdminLayout';
import { api } from '../context/AuthContext';

const Authors: React.FC = () => {
  const [authors, setAuthors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAuthors, setFilteredAuthors] = useState<any[]>([]);
  const [totalAuthors, setTotalAuthors] = useState(0);

  useEffect(() => {
    fetchAuthors();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredAuthors(authors);
    } else {
      const filtered = authors.filter(author =>
        author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        author.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
        author.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAuthors(filtered);
    }
  }, [authors, searchTerm]);

  const fetchAuthors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/authors');
      const authorsData = response.data || [];
      setAuthors(authorsData);
      setTotalAuthors(authorsData.length);
    } catch (error) {
      console.error('Error fetching authors:', error);
      toast.error('فشل في تحميل المؤلفين');
      setAuthors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المؤلف؟')) {
      return;
    }

    try {
      await api.delete(`/admin/authors/${id}`);
      toast.success('تم حذف المؤلف بنجاح');
      fetchAuthors();
    } catch (error) {
      console.error('Error deleting author:', error);
      toast.error('فشل في حذف المؤلف');
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
          <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
            <div className="h-10 bg-gray-300 rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center space-x-4 space-x-reverse mb-4">
                  <div className="w-16 h-16 bg-gray-300 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-300 rounded"></div>
                  <div className="h-3 bg-gray-300 rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">إدارة المؤلفين</h1>
          <Link
            to="/authors/create"
            className="flex items-center bg-[#005CB9] hover:bg-[#0047A0] text-white px-4 py-2 rounded-md transition-colors"
          >
            <Plus size={20} className="ml-2" />
            إضافة مؤلف جديد
          </Link>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="البحث في المؤلفين (الاسم، التخصص، الموقع)..."
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005CB9] focus:border-transparent"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute left-10 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Results counter */}
          <div className="mt-2 text-sm text-gray-600">
            {searchTerm ? (
              `عرض ${filteredAuthors.length} من أصل ${totalAuthors} مؤلف`
            ) : (
              `إجمالي ${totalAuthors} مؤلف`
            )}
          </div>
        </div>

        {/* Authors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAuthors.map((author) => (
            <div key={author.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-center space-x-4 space-x-reverse mb-4">
                  <img
                    src={author.image}
                    alt={author.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">{author.name}</h3>
                    <p className="text-sm text-[#005CB9] font-medium">{author.specialization}</p>
                    <p className="text-xs text-gray-500">{author.experience_years} سنوات خبرة</p>
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{author.bio}</p>
                
                <div className="space-y-2 text-xs text-gray-500 mb-4">
                  <div className="flex items-center">
                    <User size={12} className="ml-1" />
                    <span>{author.location}</span>
                  </div>
                  {author.email && (
                    <div className="flex items-center">
                      <Mail size={12} className="ml-1" />
                      <span>{author.email}</span>
                    </div>
                  )}
                  {author.website && (
                    <div className="flex items-center">
                      <Globe size={12} className="ml-1" />
                      <span>{author.website}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    author.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {author.is_active ? 'نشط' : 'غير نشط'}
                  </span>
                  
                  <div className="flex space-x-2 space-x-reverse">
                    <Link
                      to={`/authors/edit/${author.id}`}
                      className="text-indigo-600 hover:text-indigo-900 transition-colors"
                      title="تعديل المؤلف"
                    >
                      <Edit size={16} />
                    </Link>
                    <button
                      onClick={() => handleDelete(author.id)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="حذف المؤلف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAuthors.length === 0 && (
          <div className="text-center py-12">
            {searchTerm ? (
              <div>
                <Search size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-2">لا يوجد مؤلفون يطابقون البحث "{searchTerm}"</p>
                <button
                  onClick={clearSearch}
                  className="text-[#005CB9] hover:text-[#0047A0] font-medium"
                >
                  مسح البحث
                </button>
              </div>
            ) : (
              <div>
                <User size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">لا يوجد مؤلفون متاحون</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Authors;