import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import DOMPurify from 'dompurify';
import ShareButtons from '../components/article/ShareButtons';
import { articlesApi } from '../lib/api';

export default function SharedArticlePage() {
  const { token } = useParams(); const [article, setArticle] = useState<any>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { if (!token) return; articlesApi.getShared(token).then(setArticle).catch(() => setArticle(null)).finally(() => setLoading(false)); }, [token]);
  if (loading) return <div className="min-h-[50vh] flex items-center justify-center">جاري تحميل المقال...</div>;
  if (!article) return <div className="layout-modern py-16 text-center"><h1 className="text-2xl font-bold">المقال غير متاح</h1><p className="mt-2 text-gray-500">قد يكون الرابط غير صحيح أو أن المقال لم يعد منشوراً.</p></div>;
  const url = `${window.location.origin}/p/${token}`;
  return <article className="py-10 bg-white"><Helmet><title>{article.title}</title><meta name="robots" content="noindex, nofollow" /></Helmet><div className="container-modern max-w-3xl"><p className="text-blue-600 font-medium mb-3">صحة الفم للجميع</p><h1 className="text-3xl md:text-5xl font-bold leading-tight">{article.title}</h1><p className="text-xl text-gray-600 mt-5">{article.excerpt}</p>{article.cover_image && <img src={article.cover_image} alt="" className="w-full rounded-2xl my-8 max-h-[440px] object-cover" />}<div className="prose prose-lg max-w-none" dir="rtl" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }} /><div className="mt-10 border-t pt-6"><ShareButtons url={url} title={article.title} description={article.excerpt} /><p className="text-sm text-gray-500 mt-4">لإضافته إلى Instagram، انسخ الرابط وضعه في النبذة أو القصة.</p></div></div></article>;
}
