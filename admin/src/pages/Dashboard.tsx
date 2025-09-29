import React, { useState, useEffect } from 'react';
import { FileText, BookOpen, Users, TrendingUp, Plus, Eye, CreditCard as Edit, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import { api } from '../context/AuthContext';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalArticles: 0,
    totalResearch: 0,
    featuredArticles: 0,
    totalAuthors: 0,
    recentArticles: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch real stats from API
        const [articlesRes, researchRes, authorsRes] = await Promise.all([
          api.get('/articles'),
          api.get('/research'),
          api.get('/authors')
        ]);
        
        const articles = articlesRes.data.data || articlesRes.data || [];
        const research = researchRes.data.data || researchRes.data || [];
        const authors = authorsRes.data || [];
        
        const featuredCount = articles.filter((article: any) => article.is_featured).length;
        
        setStats({
          totalArticles: articles.length,
          totalResearch: research.length,
          featuredArticles: featuredCount,
          totalAuthors: authors.length,
          recentArticles: articles.slice(0, 5)
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        // Fallback to default values
        setStats({
          totalArticles: 0,
          totalResearch: 0,
          featuredArticles: 0,
          totalAuthors: 0,
          recentArticles: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'إجمالي المقالات',
      value: stats.totalArticles,
      icon: FileText,
      color: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'الأبحاث العلمية',
      value: stats.totalResearch,
      icon: BookOpen,
      color: 'from-purple-500 to-purple-600',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'المقالات المميزة',
      value: stats.featuredArticles,
      icon: TrendingUp,
      color: 'from-yellow-500 to-yellow-600',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'المؤلفون',
      value: stats.totalAuthors,
      icon: Users,
      color: 'from-green-500 to-green-600',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="skeleton h-8 w-64 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="stats-card">
                <div className="skeleton h-12 w-12 rounded-xl mb-4"></div>
                <div className="skeleton h-8 w-16 rounded mb-2"></div>
                <div className="skeleton h-4 w-24 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">مرحباً بك في لوحة التحكم</h1>
          <p className="text-gray-600">إدارة محتوى منصة طب الأسنان العربي</p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="stats-card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`stats-icon bg-gradient-to-r ${stat.color}`}>
                    <Icon size={20} />
                  </div>
                </div>
                <div className={`h-2 ${stat.bgColor} rounded-full overflow-hidden`}>
                  <div className={`h-full bg-gradient-to-r ${stat.color} w-full transform origin-left animate-pulse`}></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="form-section">
          <div className="form-section-title">إجراءات سريعة</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              to="/articles/create"
              className="card p-6 text-center hover:shadow-xl transition-all duration-300 group"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Plus size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">إضافة مقال جديد</h3>
              <p className="text-gray-600 text-sm">انشر مقالاً جديداً في المنصة</p>
            </Link>
            
            <Link
              to="/research/create"
              className="card p-6 text-center hover:shadow-xl transition-all duration-300 group"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <BookOpen size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">إضافة بحث علمي</h3>
              <p className="text-gray-600 text-sm">أضف بحثاً علمياً جديداً</p>
            </Link>
            
            <Link
              to="/authors/create"
              className="card p-6 text-center hover:shadow-xl transition-all duration-300 group"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Users size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">إضافة مؤلف</h3>
              <p className="text-gray-600 text-sm">أضف مؤلفاً جديداً للمنصة</p>
            </Link>
          </div>
        </div>
        
        {/* Recent Articles */}
        {stats.recentArticles.length > 0 && (
          <div className="form-section">
            <div className="form-section-title">أحدث المقالات</div>
            <div className="space-y-4">
              {stats.recentArticles.map((article: any) => (
                <div key={article.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <img
                      src={article.cover_image}
                      alt={article.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900 line-clamp-1">{article.title}</h4>
                      <p className="text-sm text-gray-600">بواسطة {article.author}</p>
                      {article.is_featured && (
                        <span className="badge badge-featured text-xs">
                          <Star size={10} className="ml-1" />
                          مميز
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Link
                      to={`/articles/edit/${article.id}`}
                      className="action-button edit"
                    >
                      <Edit size={16} />
                    </Link>
                    <a
                      href={`/articles/${article.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="action-button view"
                    >
                      <Eye size={16} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Dashboard;