import React from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import ResearchForm from '../components/forms/ResearchForm';

const CreateResearch: React.FC = () => {
  return (
    <AdminLayout>
      <ResearchForm />
    </AdminLayout>
  );
};

export default CreateResearch;