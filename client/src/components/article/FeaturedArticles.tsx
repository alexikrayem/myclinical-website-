import React, { useEffect } from 'react';
import { Loader, Clock, User, ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistance } from 'date-fns';
import { ar } from 'date-fns/locale';
import ArticleCard from './ArticleCard';
import { useFeaturedArticles } from '../../hooks/useArticles';

interface FeaturedArticlesProps {
  onItemsLoaded?: (items: any[]) => void;
}

const FeaturedArticles: React.FC<FeaturedArticlesProps> = ({ onItemsLoaded }) => {
  const { data: articles = [], isLoading: loading } = useFeaturedArticles();
  const navigate = useNavigate();

  useEffect(() => {
    if (articles.length > 0 && onItemsLoaded) {
      onItemsLoaded(articles);
    }
  }, [articles, onItemsLoaded]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-3xl card-shadow">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">جاري تحميل المقالات المميزة...</p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-3xl card-shadow">
        <p className="text-gray-500">لا توجد مقالات مميزة متاحة حالياً</p>
      </div>
    );
  }

  const mainArticle = articles[0];
  const sideArticles = articles.slice(1, 4); // Take up to 3 for the side list

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Primary Highlight */}
      <div className={`lg:col-span-${sideArticles.length > 0 ? '8' : '12'} h-full flex flex-col`}>
         <div className="flex-1">
           <ArticleCard article={mainArticle} featured={true} />
         </div>
      </div>

      {/* Secondary List */}
      {sideArticles.length > 0 && (
        <div className="lg:col-span-4 flex flex-col">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-1 flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <span className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full ml-3"></span>
              الأكثر قراءة
            </h3>
            
            <div className="flex flex-col gap-6 flex-1">
              {sideArticles.map((article: any) => {
                const formattedDate = formatDistance(
                  new Date(article.publication_date),
                  new Date(),
                  { addSuffix: true, locale: ar }
                );

                return (
                  <div 
                    key={article.id}
                    onClick={() => {
                        navigate(`/articles/${article.id}`);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="group cursor-pointer flex gap-4 items-center bg-transparent hover:bg-gray-50 rounded-2xl p-2 -mx-2 transition-colors duration-300"
                    data-testid={`featured-side-article-${article.id}`}
                  >
                    <div className="relative w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                      <img 
                        src={article.cover_image} 
                        alt={article.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                    <div className="flex flex-col flex-1 justify-center">
                      <h4 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors mb-2">
                        {article.title}
                      </h4>
                      <div className="flex items-center text-xs text-gray-500 gap-3">
                        <span className="flex items-center truncate max-w-[80px]" title={article.author}>
                           <User size={12} className="ml-1 flex-shrink-0"/> {article.author}
                        </span>
                        <span className="flex items-center text-gray-400 whitespace-nowrap">
                           <Clock size={12} className="ml-1 flex-shrink-0"/> {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <Link 
              to="/articles" 
              className="mt-6 flex items-center justify-center w-full py-3 bg-gray-50 border border-gray-100 hover:border-blue-200 hover:bg-blue-50 text-blue-600 font-bold rounded-xl transition-all duration-300 group shadow-sm"
            >
              عرض جميع المقالات
              <ChevronLeft size={16} className="mr-2 transform group-hover:-translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeaturedArticles;