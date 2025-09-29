import React from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import ArticleForm from '../components/forms/ArticleForm';

const CreateArticle: React.FC = () => {
  return (
    <AdminLayout>
      <ArticleForm />
    </AdminLayout>
  );
};

export default CreateArticle;