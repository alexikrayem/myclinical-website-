import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <h1 className="text-9xl font-bold text-[#005CB9]">404</h1>
        <h2 className="text-3xl font-bold text-gray-800 mt-4 mb-6">الصفحة غير موجودة</h2>
        <p className="text-gray-600 max-w-md mx-auto mb-8">
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى عنوان آخر.
        </p>
        <Link
          to="/"
          className="inline-flex items-center bg-[#005CB9] hover:bg-[#0047A0] text-white px-6 py-3 rounded-md transition-colors"
        >
          <Home size={18} className="ml-2" />
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;