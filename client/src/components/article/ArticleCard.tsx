import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Tag, User, ArrowLeft, Sparkles } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ArticleCardProps {
  article: {
    id: string;
    title: string;
    excerpt: string;
    cover_image: string;
    publication_date: string;
    author: string;
    tags: string[];
    is_featured?: boolean;
    author_image?: string;
  };
  featured?: boolean;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, featured = false }) => {
  const navigate = useNavigate();

  const formattedDate = formatDistance(
    new Date(article.publication_date),
    new Date(),
    { addSuffix: true, locale: ar }
  );

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation if clicking on a link or button
    if ((e.target as HTMLElement).closest('a, button')) {
      return;
    }

    // Navigate to article and scroll to top
    navigate(`/articles/${article.id}`);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  if (featured) {
    return (
      <div
        className="relative overflow-hidden rounded-3xl card-shadow-lg group cursor-pointer transition-modern hover:scale-[1.02]"
        onClick={handleCardClick}
      >
        <div className="relative h-[500px]">
          <img
            src={article.cover_image}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>

          <div className="absolute top-6 right-6">
            <span className="status-featured inline-flex items-center">
              <Sparkles size={14} className="ml-1" />
              مقال مميز
            </span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
            <h2 className="text-2xl lg:text-3xl font-bold mb-3 line-clamp-2 leading-tight">{article.title}</h2>
            <p className="mb-4 text-blue-100 line-clamp-2 text-lg leading-relaxed">{article.excerpt}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm text-blue-200 space-x-4 space-x-reverse">
                <div className="flex items-center">
                  {article.author_image ? (
                    <img
                      src={article.author_image}
                      alt={article.author}
                      className="w-8 h-8 rounded-full object-cover ml-2 border-2 border-white/20"
                    />
                  ) : (
                    <User size={16} className="ml-1" />
                  )}
                  <span className="font-medium">{article.author}</span>
                </div>
                <div className="flex items-center">
                  <Clock size={16} className="ml-1" />
                  <span>{formattedDate}</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/articles/${article.id}`);
                  setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }, 100);
                }}
                className="btn-primary inline-flex items-center bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30"
              >
                اقرأ المزيد
                <ArrowLeft size={18} className="mr-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden card-shadow group cursor-pointer transition-modern hover:scale-[1.02] animate-scaleIn"
      onClick={handleCardClick}
    >
      <div className="relative overflow-hidden">
        <img
          src={article.cover_image}
          alt={article.title}
          className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        {article.is_featured && (
          <div className="absolute top-4 right-4">
            <span className="status-featured inline-flex items-center text-xs">
              <Sparkles size={12} className="ml-1" />
              مميز
            </span>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {article.tags.slice(0, 2).map((tag, index) => (
            <Link
              key={index}
              to={`/articles?tag=${encodeURIComponent(tag)}`}
              className="tag-modern inline-flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Tag size={12} className="ml-1" />
              {tag}
            </Link>
          ))}
          {article.tags.length > 2 && (
            <span className="text-xs text-gray-400 px-2 py-1">
              +{article.tags.length - 2} أخرى
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
          {article.title}
        </h3>

        <p className="text-gray-600 mb-4 line-clamp-2 leading-relaxed">{article.excerpt}</p>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center text-sm text-gray-500">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center ml-3">
              <User size={14} className="text-white" />
            </div>
            <div>
              <div className="font-medium text-gray-700">{article.author}</div>
              <div className="text-xs text-gray-500">{formattedDate}</div>
            </div>
          </div>

          <div className="text-blue-600 group-hover:text-blue-700 transition-colors">
            <ArrowLeft size={20} className="transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticleCard;