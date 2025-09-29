import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, TrendingUp } from 'lucide-react';
import ArticleList from '../components/article/ArticleList';

const ArticlesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tag = searchParams.get('tag') || undefined;
  const search = searchParams.get('search') || undefined;

  return (
    <div className="layout-modern py-12">
      <div className="container-modern">
        <div className="text-center mb-12">
          <div className="inline-flex items-center bg-blue-100 text-blue-800 rounded-full px-4 py-2 mb-6">
            <BookOpen className="w-4 h-4 ml-2" />
            <span className="text-sm font-medium">مكتبة المقالات</span>
          </div>
          
          <h1 className="heading-modern text-4xl lg:text-5xl text-gray-900 mb-4">
            {search ? `نتائج البحث عن "${search}"` : 
             tag ? `مقالات في ${tag}` : 
             'جميع المقالات'}
          </h1>
          
          <p className="text-modern text-lg max-w-2xl mx-auto">
            {search 
              ? `استعرض نتائج البحث عن "${search}" في مكتبة المقالات`
              : tag 
                ? `تصفح أحدث المقالات والموضوعات المتعلقة بـ ${tag}`
                : 'استكشف مكتبة شاملة من المقالات المتخصصة في مجال طب الأسنان'
            }
          </p>
        </div>
        
        <ArticleList tag={tag} limit={24} />
      </div>
    </div>
  );
};

export default ArticlesPage;