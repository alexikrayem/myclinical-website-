import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, Search, X, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../components/layout/AdminLayout';
import { api } from '../context/AuthContext';

const Articles: React.FC = () => {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredArticles, setFilteredArticles] = useState<any[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);

  useEffect(() => {
    fetchArticles();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredArticles(articles);
    } else {
      const filtered = articles.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (article.tags && article.tags.some((tag: string) => 
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
      setFilteredArticles(filtered);
    }
  }, [articles, searchTerm]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/articles');
      const articlesData = response.data.data || response.data || [];
      setArticles(articlesData);
      setTotalArticles(articlesData.length);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('فشل في تحميل المقالات');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المقال؟')) {
      return;
    }

    try {
      await api.delete(`/admin/articles/${id}`);
      toast.success('تم حذف المقال بنجاح');
      fetchArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('فشل في حذف المقال');
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
          <div className="space-y-4">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
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
          <h1 className="text-3xl font-bold text-gray-800">إدارة المقالات</h1>
          <Link
            to="/articles/create"
            className="flex items-center bg-[#005CB9] hover:bg-[#0047A0] text-white px-4 py-2 rounded-md transition-colors"
          >
            <Plus size={20} className="ml-2" />
            إضافة مقال جديد
          </Link>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="البحث في المقالات (العنوان، المؤلف، المحتوى، العلامات)..."
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
              `عرض ${filteredArticles.length} من أصل ${totalArticles} مقال`
            ) : (
              `إجمالي ${totalArticles} مقال`
            )}
          </div>
        </div>

        {/* Articles Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    العنوان
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المؤلف
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الحالة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    تاريخ النشر
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredArticles.map((article) => (
                  <tr key={article.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <img
                          src={article.cover_image}
                          alt={article.title}
                          className="w-12 h-12 rounded-lg object-cover ml-4"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 line-clamp-2">
                            {article.title}
                          </div>
                          <div className="text-sm text-gray-500 line-clamp-1">
                            {article.excerpt.substring(0, 100)}...
                          </div>
                          {article.tags && article.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {article.tags.slice(0, 2).map((tag: string, index: number) => (
                                <span
                                  key={index}
                                  className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                              {article.tags.length > 2 && (
                                <span className="text-xs text-gray-500">
                                  +{article.tags.length - 2} أخرى
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {article.author}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        article.is_featured
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {article.is_featured ? 'مميز' : 'منشور'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(article.publication_date).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2 space-x-reverse">
                        <a
                          href={`/articles/${article.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="عرض المقال"
                        >
                          <Eye size={16} />
                        </a>
                        <Link
                          to={`/articles/edit/${article.id}`}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors"
                          title="تعديل المقال"
                        >
                          <Edit size={16} />
                        </Link>
                        <button
                          onClick={() => handleDelete(article.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="حذف المقال"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredArticles.length === 0 && (
            <div className="text-center py-8">
              {searchTerm ? (
                <div>
                  <Search size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-2">لا توجد مقالات تطابق البحث "{searchTerm}"</p>
                  <button
                    onClick={clearSearch}
                    className="text-[#005CB9] hover:text-[#0047A0] font-medium"
                  >
                    مسح البحث
                  </button>
                </div>
              ) : (
                <p className="text-gray-500">لا توجد مقالات متاحة</p>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Articles;