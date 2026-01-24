import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  Users,
  Plus,
  Sparkles,
  Shield,
  Video,
  CreditCard,
  LogOut,
  Tag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { logout } = useAuth();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const menuItems = [
    {
      icon: LayoutDashboard,
      label: 'لوحة التحكم',
      path: '/',
      color: 'text-blue-500',
    },
    {
      icon: FileText,
      label: 'المقالات',
      path: '/articles',
      color: 'text-green-500',
    },
    {
      icon: Plus,
      label: 'إضافة مقال',
      path: '/articles/create',
      color: 'text-green-400',
    },
    {
      icon: Tag,
      label: 'التصنيفات',
      path: '/categories',
      color: 'text-yellow-500',
    },
    {
      icon: BookOpen,
      label: 'الأبحاث',
      path: '/research',
      color: 'text-purple-500',
    },
    {
      icon: Plus,
      label: 'إضافة بحث',
      path: '/research/create',
      color: 'text-purple-400',
    },
    {
      icon: Users,
      label: 'المؤلفون',
      path: '/authors',
      color: 'text-orange-500',
    },
    {
      icon: Plus,
      label: 'إضافة مؤلف',
      path: '/authors/create',
      color: 'text-orange-400',
    },
    {
      icon: Video,
      label: 'الدورات',
      path: '/courses',
      color: 'text-blue-600',
    },
    {
      icon: Plus,
      label: 'إضافة دورة',
      path: '/courses/create',
      color: 'text-blue-400',
    },
    {
      icon: CreditCard,
      label: 'بطاقات الرصيد',
      path: '/codes/generate',
      color: 'text-indigo-500',
    },
    {
      icon: Shield,
      label: 'التقارير',
      path: '/licenses',
      color: 'text-red-500',
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">لوحة التحكم</h2>
            <p className="text-xs text-gray-500">طب الأسنان العربي</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <Icon size={20} className="sidebar-icon" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-red-600 hover:bg-red-50"
        >
          <LogOut size={20} className="sidebar-icon" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;