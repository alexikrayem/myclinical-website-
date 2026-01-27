import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Calendar, User, Tag, ChevronRight, ChevronLeft, Clock, Bookmark, Sparkles, FileText, Lock, Coins } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ArticleCard from '../components/article/ArticleCard';
import AuthorCard from '../components/article/AuthorCard';
import ShareButtons from '../components/article/ShareButtons';
import { articlesApi, creditsApi } from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Skeleton from '../components/ui/Skeleton';

const ArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, refreshCredits } = useAuth();
  const [article, setArticle] = useState<any | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [requiresCredits, setRequiresCredits] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState(false);

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

        // Use server-side access check if available
        if (typeof data.has_access !== 'undefined') {
          setHasAccess(data.has_access);
        } else {
          // Fallback for older API response structure? Or just double check credits?
          // If user is logged in, double check to be safe or if API didn't return it
          if (user) {
            const accessData = await creditsApi.checkArticleAccess(id);
            setHasAccess(accessData.has_access);
          }
        }

        // Always fetch requirement 
        // (Optimally this should be in the article response too, but let's keep it safe)
        const accessData = await creditsApi.checkArticleAccess(id);
        setRequiresCredits(accessData.credits_required || 0);

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
  }, [id, user]);

  const handleUnlock = async () => {
    if (!id || !user) {
      toast.error('الرجاء تسجيل الدخول للمتابعة');
      return;
    }

    try {
      setIsUnlocking(true);
      const result = await creditsApi.consumeArticle(id);
      if (result.success) {
        toast.success(result.message || 'تم فتح المقال بنجاح');
        setHasAccess(true);
        refreshCredits();
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'فشل في فتح المقال';
      toast.error(errorMsg);
    } finally {
      setIsUnlocking(false);
    }
  };

  // ...

  if (loading) {
    return (
      <div className="layout-modern py-12">
        <div className="container-modern">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl p-8 card-shadow space-y-8">
              {/* Cover Image Skeleton */}
              <Skeleton className="w-full h-80 rounded-2xl" type="rect" />

              {/* Header Skeleton */}
              <div className="space-y-4">
                <Skeleton className="w-3/4 h-12" />
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-10 h-10 rounded-full" type="circle" />
                    <div className="space-y-2">
                      <Skeleton className="w-24 h-4" />
                      <Skeleton className="w-16 h-3" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Skeleton */}
              <div className="space-y-3 pt-8">
                <Skeleton className="w-full h-4" count={6} />
                <Skeleton className="w-2/3 h-4" />
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

  // Calculate read time (approx 200 words per minute for Arabic)
  const calculateReadTime = (content: string): number => {
    const text = content.replace(/<[^>]*>/g, ''); // Strip HTML
    const wordCount = text.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 200));
  };

  const readTime = calculateReadTime(article.content || '');
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="layout-modern py-12">
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{article.title} | طبيب</title>
        <meta name="description" content={article.excerpt} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.excerpt} />
        <meta property="og:image" content={article.cover_image} />
        <meta property="og:url" content={currentUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:locale" content="ar_SA" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.excerpt} />
        <meta name="twitter:image" content={article.cover_image} />
        <meta name="author" content={article.author} />
        <link rel="canonical" href={currentUrl} />
      </Helmet>

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
                <span>{readTime} دقائق للقراءة</span>
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
              <ShareButtons
                url={currentUrl}
                title={article.title}
                description={article.excerpt}
              />
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
              loading="lazy"
              className="w-full h-auto rounded-3xl shadow-2xl"
            />
          </div>

          {/* Author Card */}
          <AuthorCard authorName={article.author} className="mb-12" />

          {/* Article Content */}
          <div className="form-modern mb-12 relative">
            <div className="prose prose-lg max-w-none relative">
              <div className="text-xl font-semibold text-gray-800 mb-8 p-6 bg-blue-50 rounded-2xl border-r-4 border-blue-500">
                {article.excerpt}
              </div>

              {!hasAccess && requiresCredits > 0 ? (
                <div className="relative">
                  <div className="text-gray-700 leading-relaxed text-lg filter blur-lg select-none pointer-events-none opacity-50">
                    <p>هذا المحتوى محمي ويتطلب رصيداً للوصول إليه. يمكنك فتح المقال مقابل رصيد واحد فقط من رصيدك الحالي. بمجرد الفتح سيظل المقال متاحاً لك دائماً.</p>
                    <p>تعتبر المقالات البحثية المتخصصة جزءاً من المحتوى المتميز الذي نقدمه لزبائننا لتطوير مهاراتهم ومعرفتهم العلمية في مجال طب الأسنان.</p>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white/40 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-inner">
                    <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md border border-gray-50">
                      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                        <Lock size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">هذا المقال مغلق</h3>
                      <p className="text-gray-600 mb-6">يتطلب هذا المقال المتميز {requiresCredits} رصيد لفتحه بشكل دائم.</p>
                      <button
                        onClick={handleUnlock}
                        disabled={isUnlocking}
                        className="w-full btn-primary flex items-center justify-center py-3 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                      >
                        {isUnlocking ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <Coins size={18} className="ml-2" />
                            فتح المقال الآن
                          </>
                        )}
                      </button>
                      {!user && (
                        <p className="mt-4 text-sm text-gray-500">
                          الرجاء <Link to="/login" className="text-blue-600 font-semibold">تسجيل الدخول</Link> أولاً
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="text-gray-700 leading-relaxed text-lg"
                  dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, '<br>') }}
                />
              )}
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