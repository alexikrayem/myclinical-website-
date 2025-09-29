import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Bell, Settings } from 'lucide-react';
import Sidebar from './Sidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100" dir="rtl">
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Modern Header */}
        <header className="header">
          <div className="header-content">
            <div>
              <h1 className="header-title">لوحة التحكم</h1>
              <p className="text-sm text-gray-600">منصة طب الأسنان العربي</p>
            </div>
            <div className="header-actions">
              <button className="action-button">
                <Bell size={20} />
              </button>
              <button className="action-button">
                <Settings size={20} />
              </button>
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{user?.email}</p>
                  <p className="text-xs text-gray-500">مدير النظام</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="content-area">
          <div className="content-container">
          {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;