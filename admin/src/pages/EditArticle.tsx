import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import ArticleForm from '../components/forms/ArticleForm';
import { api } from '../context/AuthContext';

const EditArticle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        if (!id) return;
        const response = await api.get(`/articles/${id}`);
        setArticle(response.data);
      } catch (error) {
        console.error('Error fetching article:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="space-y-4">
              <div className="h-4 bg-gray-300 rounded w-1/4"></div>
              <div className="h-10 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded w-1/4"></div>
              <div className="h-32 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!article) {
    return (
      <AdminLayout>
        <div className="text-center py-8">
          <p className="text-gray-500">المقال غير موجود</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ArticleForm article={article} isEditing={true} />
    </AdminLayout>
  );
};

export default EditArticle;