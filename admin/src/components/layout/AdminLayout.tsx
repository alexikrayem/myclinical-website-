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
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <Sidebar />
      </div>
      
      {/* Main Content Area */}
      <div className="admin-main">
        {/* Header */}
        <header className="admin-header">
          <div className="header-content">
            <div>
              <h1 className="header-title">لوحة التحكم</h1>
              <p className="text-sm text-gray-600">منصة طب الأسنان العربي</p>
            </div>
            
            <div className="header-actions">
              <button className="action-button" title="الإشعارات">
                <Bell size={20} />
              </button>
              <button className="action-button" title="الإعدادات">
                <Settings size={20} />
              </button>
              <div className="flex items-center space-x-3 space-x-reverse">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <User size={20} className="text-white" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{user?.email}</p>
                  <p className="text-xs text-gray-500">مدير النظام</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;