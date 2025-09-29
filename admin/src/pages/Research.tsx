import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Download, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '../components/layout/AdminLayout';
import { api } from '../context/AuthContext';

const Research: React.FC = () => {
  const [researches, setResearches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResearches, setFilteredResearches] = useState<any[]>([]);
  const [totalResearches, setTotalResearches] = useState(0);

  useEffect(() => {
    fetchResearches();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredResearches(researches);
    } else {
      const filtered = researches.filter(research =>
        research.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        research.journal.toLowerCase().includes(searchTerm.toLowerCase()) ||
        research.abstract.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (research.authors && research.authors.some((author: string) => 
          author.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
      setFilteredResearches(filtered);
    }
  }, [researches, searchTerm]);

  const fetchResearches = async () => {
    try {
      setLoading(true);
      const response = await api.get('/research');
      const researchData = response.data.data || response.data || [];
      setResearches(researchData);
      setTotalResearches(researchData.length);
    } catch (error) {
      console.error('Error fetching researches:', error);
      toast.error('فشل في تحميل الأبحاث');
      setResearches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا البحث؟')) {
      return;
    }

    try {
      await api.delete(`/admin/research/${id}`);
      toast.success('تم حذف البحث بنجاح');
      fetchResearches();
    } catch (error) {
      console.error('Error deleting research:', error);
      toast.error('فشل في حذف البحث');
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
          <h1 className="text-3xl font-bold text-gray-800">إدارة الأبحاث</h1>
          <Link
            to="/research/create"
            className="flex items-center bg-[#005CB9] hover:bg-[#0047A0] text-white px-4 py-2 rounded-md transition-colors"
          >
            <Plus size={20} className="ml-2" />
            إضافة بحث جديد
          </Link>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="البحث في الأبحاث (العنوان، المجلة، الملخص، المؤلفون)..."
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
              `عرض ${filteredResearches.length} من أصل ${totalResearches} بحث`
            ) : (
              `إجمالي ${totalResearches} بحث`
            )}
          </div>
        </div>

        {/* Research Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    العنوان
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المجلة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المؤلفون
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
                {filteredResearches.map((research) => (
                  <tr key={research.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 line-clamp-2">
                        {research.title}
                      </div>
                      <div className="text-sm text-gray-500 line-clamp-2 mt-1">
                        {research.abstract.substring(0, 150)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {research.journal}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="line-clamp-2">
                        {research.authors.join('، ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(research.publication_date).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2 space-x-reverse">
                        <a
                          href={research.file_url}
                          download
                          className="text-green-600 hover:text-green-900 transition-colors"
                          title="تحميل البحث"
                        >
                          <Download size={16} />
                        </a>
                        <Link
                          to={`/research/edit/${research.id}`}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors"
                          title="تعديل البحث"
                        >
                          <Edit size={16} />
                        </Link>
                        <button
                          onClick={() => handleDelete(research.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="حذف البحث"
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

          {filteredResearches.length === 0 && (
            <div className="text-center py-8">
              {searchTerm ? (
                <div>
                  <Search size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-2">لا توجد أبحاث تطابق البحث "{searchTerm}"</p>
                  <button
                    onClick={clearSearch}
                    className="text-[#005CB9] hover:text-[#0047A0] font-medium"
                  >
                    مسح البحث
                  </button>
                </div>
              ) : (
                <p className="text-gray-500">لا توجد أبحاث متاحة</p>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Research;