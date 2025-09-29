import React from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import AuthorForm from '../components/forms/AuthorForm';

const CreateAuthor: React.FC = () => {
  return (
    <AdminLayout>
      <AuthorForm />
    </AdminLayout>
  );
};

export default CreateAuthor;