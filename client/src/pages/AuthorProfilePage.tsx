import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ShareButtons from '../components/article/ShareButtons';
import { authorsApi } from '../lib/api';

const allowedSocials = new Set(['instagram', 'facebook', 'x', 'tiktok', 'youtube', 'linkedin', 'website']);
const isSafeHttps = (value: string) => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };

export default function AuthorProfilePage() {
  const { slug } = useParams(); const [profile, setProfile] = useState<any>(null);
  useEffect(() => { if (slug) authorsApi.getBySlug(slug).then(setProfile).catch(() => setProfile(null)); }, [slug]);
  if (!profile) return <div className="layout-modern py-16 text-center">جاري تحميل الملف، أو أن الصفحة غير متاحة.</div>;
  const url = `${window.location.origin}/u/${slug}`;
  return <div className="layout-modern py-10"><Helmet><title>{profile.name} | MyClinical</title><meta name="description" content={profile.headline || profile.bio} /></Helmet><div className="container-modern max-w-5xl"><section className="bg-white rounded-3xl p-8 text-center shadow-sm"><img className="w-28 h-28 rounded-full object-cover mx-auto" src={profile.avatar_url || profile.image} alt="" /><h1 className="text-3xl font-bold mt-4">{profile.name}</h1>{profile.headline && <p className="text-blue-600 mt-2">{profile.headline}</p>}<p className="text-gray-500 mt-2">{profile.specialization}</p><p className="max-w-2xl mx-auto mt-5 text-gray-700">{profile.bio}</p><div className="flex justify-center gap-3 mt-5 flex-wrap">{Object.entries(profile.social_links || {}).filter(([key, value]) => allowedSocials.has(key) && typeof value === 'string' && isSafeHttps(value)).map(([key, value]) => <a key={key} href={value as string} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-600 underline">{key}</a>)}</div><div className="mt-6 flex justify-center"><ShareButtons url={url} title={profile.name} /></div></section><section className="mt-8"><h2 className="text-2xl font-bold mb-4">المقالات المنشورة</h2><div className="grid md:grid-cols-3 gap-4">{(profile.articles || []).map((article: any) => <Link key={article.id} to={`/articles/${article.slug || article.id}`} className="bg-white rounded-2xl overflow-hidden shadow-sm"><img src={article.cover_image} alt="" className="w-full h-40 object-cover" /><div className="p-4"><h3 className="font-bold">{article.title}</h3><p className="text-sm text-gray-500 mt-2">{article.excerpt}</p></div></Link>)}</div></section>{(profile.courses || []).length > 0 && <section className="mt-8"><h2 className="text-2xl font-bold mb-4">الدورات المنشورة</h2><div className="grid md:grid-cols-3 gap-4">{profile.courses.map((course: any) => <Link key={course.id} to={`/courses/${course.id}`} className="bg-white rounded-2xl p-4 shadow-sm font-bold">{course.title}</Link>)}</div></section>}</div></div>;
}
