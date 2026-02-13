import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Calendar, User, Tag, ChevronRight, ChevronLeft, Clock, Bookmark, Sparkles, FileText, Lock, Coins } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import axios from 'axios';
import ArticleCard from '../components/article/ArticleCard';
import AuthorCard from '../components/article/AuthorCard';
import ShareButtons from '../components/article/ShareButtons';
import { articlesApi, creditsApi } from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Skeleton from '../components/ui/Skeleton';

interface ArticleDetail {
  id: string;
  slug?: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  publication_date: string;
  author: string;
  tags: string[];
  is_featured?: boolean;
  credits_required?: number;
  has_access?: boolean;
  is_preview?: boolean;
}

interface RelatedArticle {
  id: string;
  title: string;
  excerpt: string;
  cover_image: string;
  publication_date: string;
  author: string;
  tags: string[];
  article_type?: 'article' | 'clinical_case';
  score?: number;
}

const ArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, refreshCredits } = useAuth();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
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

        // Always use canonical UUID from API response for endpoints that require article_id
        const articleId = data?.id || id;

        // Use server-side access check if available; fallback to credits endpoint
        if (typeof data.has_access !== 'undefined') {
          setHasAccess(data.has_access);
        } else if (user && articleId) {
          try {
            const accessData = await creditsApi.checkArticleAccess(articleId);
            setHasAccess(accessData.has_access);
          } catch (error) {
            console.error('Error checking article access:', error);
          }
        }

        // Fetch required credits (does not block rendering the article)
        if (articleId) {
          try {
            const accessData = await creditsApi.checkArticleAccess(articleId);
            setRequiresCredits(accessData.credits_required || 0);
          } catch (error) {
            console.error('Error fetching article credit requirement:', error);
            setRequiresCredits(data?.credits_required || 0);
          }
        }

        // Fetch related articles
        try {
          const relatedData = await articlesApi.getRelated(articleId, 3);
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
    } catch (error: unknown) {
      const errorMsg = axios.isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
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

              {!hasAccess ? (
                <div className="relative mt-12 mb-16">
                  {/* Truncated Content with Gradient Fade */}
                  <div className="relative overflow-hidden max-h-[400px] select-none pointer-events-none">
                    <div className="text-gray-700 leading-relaxed text-lg opacity-40">
                      <p className="mb-6">هذا المحتوى محمي ويتطلب تسجيل الدخول للوصول إليه. بمجرد تسجيل الدخول، ستتمكن من قراءة المقال بالكامل والوصول إلى كافة الميزات الحصرية للمنصة.</p>
                      <p className="mb-6">تعتبر المنصة مرجعاً طبياً متخصصاً يهدف لتطوير مهارات ومعرفة أطباء الأسنان في الوطن العربي من خلال محتوى علمي رصين ومحدث.</p>
                      <p className="mb-6">يتضمن هذا المقال المتميز تحليلات عميقة ودراسات سريرية موثقة تساعدك في ممارستك اليومية بمهارة وثقة أكبر.</p>
                      <p className="mb-6">هذا المحتوى محمي ويتطلب تسجيل الدخول للوصول إليه. بمجرد تسجيل الدخول، ستتمكن من قراءة المقال بالكامل والوصول إلى كافة الميزات الحصرية للمنصة.</p>
                    </div>
                    {/* Professional Gradient Overaly */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-white z-10" />
                  </div>

                  {/* Enhanced Lock Interaction Card */}
                  <div className="relative z-20 -mt-24">
                    <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-white/50 text-center max-w-xl mx-auto transform transition-all hover:translate-y-[-4px]">
                      <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-200 rotate-3 animate-float">
                        <Lock size={40} className="text-white -rotate-3" />
                      </div>

                      {!user ? (
                        <>
                          <h3 className="heading-modern text-3xl text-gray-900 mb-4">سجل دخولك للمتابعة</h3>
                          <p className="text-gray-600 mb-10 text-lg leading-relaxed">
                            انضم إلى <span className="text-blue-600 font-bold">+10,000</span> طبيب أسنان يستفيدون من المحتوى العلمي الحصري يومياً.
                          </p>
                          <Link
                            to="/login"
                            className="w-full btn-primary flex items-center justify-center py-4 bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all active:scale-95"
                          >
                            <span className="font-bold text-lg">تسجيل الدخول / إنشاء حساب</span>
                          </Link>
                          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-400">
                            <Sparkles size={16} className="text-blue-400" />
                            <span>الوصول للمقالات العلمية أسهل مما تتخيل</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <h3 className="heading-modern text-3xl text-gray-900 mb-4">فتح محتوى المقال</h3>
                          <p className="text-gray-600 mb-10 text-lg leading-relaxed">
                            يتطلب هذا المقال المتميز <span className="text-blue-600 font-bold">{requiresCredits} رصيد</span> لفتحه بشكل دائم والوصول إلى كامل المعلومة.
                          </p>
                          <button
                            onClick={handleUnlock}
                            disabled={isUnlocking}
                            className="w-full btn-primary flex items-center justify-center py-4 bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all active:scale-95"
                          >
                            {isUnlocking ? (
                              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <Coins size={22} className="ml-3 group-hover:rotate-12 transition-transform" />
                                <span className="font-bold text-lg">فتح المقال الآن</span>
                              </>
                            )}
                          </button>
                          <p className="mt-6 text-sm text-gray-400">سيتم خصم الرصيد مرة واحدة فقط</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="text-gray-700 leading-relaxed text-lg space-y-6 article-body-content"
                  dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, '<br>') }}
                />
              )}
            </div>
          </div>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="mb-24 mt-16 pt-16 border-t border-gray-100">
              <div className="flex items-end justify-between mb-12">
                <div>
                  <h2 className="heading-modern text-3xl text-gray-900 mb-2">مقالات ذات صلة</h2>
                  <p className="text-gray-500">اخترنا لك مواضيع مشابهة قد تهمك</p>
                </div>
                <Link to="/articles" className="text-blue-600 font-bold flex items-center gap-1 hover:gap-2 transition-all">
                  عرض الكل
                  <ChevronLeft size={20} />
                </Link>
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
