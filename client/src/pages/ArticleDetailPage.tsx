import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, User, Tag, ChevronRight, ChevronLeft, Clock, Share2, Bookmark, Sparkles, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ArticleCard from '../components/article/ArticleCard';
import AuthorCard from '../components/article/AuthorCard';
import { articlesApi } from '../lib/api';

const ArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<any | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Scroll to top when component mounts or ID changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        
        if (!id) return;
        
        const data = await articlesApi.getById(id);
        setArticle(data);

        // Fetch related articles
        try {
          const relatedData = await articlesApi.getRelated(id, 3);
          setRelatedArticles(relatedData || []);
        } catch (error) {
          console.error('Error fetching related articles:', error);
          setRelatedArticles([]);
        }
      } catch (error) {
        console.error('Error fetching article:', error);
        setArticle(null);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="layout-modern py-12">
        <div className="container-modern">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              <div className="skeleton h-80 rounded-3xl"></div>
              <div className="space-y-4">
                <div className="skeleton h-10 w-3/4"></div>
                <div className="skeleton h-4 w-1/4"></div>
                <div className="skeleton h-4 w-full"></div>
                <div className="skeleton h-4 w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="layout-modern py-12">
        <div className="container-modern">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText size={32} className="text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">المقال غير موجود</h1>
            <p className="text-gray-600 mb-8">
              عذراً، المقال الذي تبحث عنه غير موجود أو تم نقله.
            </p>
            <Link
              to="/articles"
              className="btn-primary inline-flex items-center"
            >
              <ChevronRight size={18} className="ml-2" />
              العودة إلى المقالات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const formattedDate = format(
    new Date(article.publication_date),
    'dd MMMM yyyy',
    { locale: ar }
  );

  return (
    <div className="layout-modern py-12">
      <div className="container-modern">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 space-x-reverse text-sm text-gray-500 mb-8">
            <Link to="/" className="hover:text-blue-600 transition-colors">الرئيسية</Link>
            <ChevronLeft size={16} />
            <Link to="/articles" className="hover:text-blue-600 transition-colors">المقالات</Link>
            <ChevronLeft size={16} />
            <span className="text-gray-800 truncate">{article.title}</span>
          </nav>

          {/* Article Header */}
          <div className="mb-8">
            {article.is_featured && (
              <div className="inline-flex items-center status-featured mb-4">
                <Sparkles size={14} className="ml-1" />
                مقال مميز
              </div>
            )}
            
            <h1 className="heading-modern text-4xl lg:text-5xl text-gray-900 mb-6 leading-tight">
              {article.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-6 text-gray-600 mb-6">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center ml-3">
                  <User size={18} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{article.author}</div>
                  <div className="text-sm text-gray-500">كاتب ومختص</div>
                </div>
              </div>
              
              <div className="flex items-center">
                <Calendar size={18} className="ml-2 text-blue-500" />
                <span className="font-medium">{formattedDate}</span>
              </div>
              
              <div className="flex items-center">
                <Clock size={18} className="ml-2 text-green-500" />
                <span>5 دقائق قراءة</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {article.tags.map((tag: string, index: number) => (
                <Link 
                  key={index}
                  to={`/articles?tag=${encodeURIComponent(tag)}`}
                  className="tag-modern inline-flex items-center"
                >
                  <Tag size={12} className="ml-1" />
                  {tag}
                </Link>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-4 mb-8">
              <button className="btn-secondary inline-flex items-center">
                <Share2 size={18} className="ml-2" />
                مشاركة
              </button>
              <button className="btn-secondary inline-flex items-center">
                <Bookmark size={18} className="ml-2" />
                حفظ للقراءة لاحقاً
              </button>
            </div>
          </div>

          {/* Article Cover Image */}
          <div className="mb-12">
            <img 
              src={article.cover_image} 
              alt={article.title}
              className="w-full h-auto rounded-3xl shadow-2xl"
            />
          </div>

          {/* Author Card */}
          <AuthorCard authorName={article.author} className="mb-12" />

          {/* Article Content */}
          <div className="form-modern mb-12">
            <div className="prose prose-lg max-w-none">
              <div className="text-xl font-semibold text-gray-800 mb-8 p-6 bg-blue-50 rounded-2xl border-r-4 border-blue-500">
                {article.excerpt}
              </div>
              
              <div 
                className="text-gray-700 leading-relaxed text-lg"
                dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, '<br>') }} 
              />
            </div>
          </div>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="mb-12">
              <div className="text-center mb-8">
                <h2 className="heading-modern text-3xl text-gray-900 mb-4">مقالات ذات صلة</h2>
                <p className="text-modern">اكتشف المزيد من المقالات المشابهة</p>
              </div>
              <div className="grid-modern">
                {relatedArticles.map((relatedArticle) => (
                  <ArticleCard key={relatedArticle.id} article={relatedArticle} />
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center pt-8 border-t border-gray-200">
            <Link
              to="/articles"
              className="btn-secondary inline-flex items-center"
            >
              <ChevronRight size={20} className="ml-2" />
              العودة إلى المقالات
            </Link>
            
            {relatedArticles.length > 0 && (
              <Link
                to={`/articles/${relatedArticles[0].id}`}
                className="btn-primary inline-flex items-center"
              >
                المقال التالي
                <ChevronLeft size={20} className="mr-2" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticleDetailPage;