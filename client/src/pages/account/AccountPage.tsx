import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { creatorApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

type Submission = { id: string; title: string; status: string; rejection_reason?: string | null; share_token?: string | null; audience?: string; visibility?: string };
type Profile = { slug?: string; headline?: string; bio?: string; social_links?: Record<string, string>; stats?: { articles: number; courses: number } };

const statusLabel: Record<string, string> = { draft: 'مسودة', pending: 'قيد المراجعة', approved: 'منشور', rejected: 'مرفوض' };

export default function AccountPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'articles' | 'courses' | 'profile'>('articles');
  const [articles, setArticles] = useState<Submission[]>([]);
  const [courses, setCourses] = useState<Submission[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [profileData, articleData] = await Promise.all([creatorApi.getProfile(), creatorApi.getArticles()]);
      setProfile(profileData); setArticles(articleData);
      if (user?.role === 'doctor' && user.verification_status === 'approved') setCourses(await creatorApi.getCourses());
    } catch { toast.error('تعذر تحميل لوحة الكاتب'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user?.role, user?.verification_status]);
  const submit = async (id: string, type: 'article' | 'course') => {
    try { type === 'article' ? await creatorApi.submitArticle(id) : await creatorApi.submitCourse(id); toast.success('تم إرسال المحتوى للمراجعة'); load(); }
    catch { toast.error('تعذر إرسال المحتوى للمراجعة'); }
  };
  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      const saved = await creatorApi.updateProfile({ headline: form.get('headline'), bio: form.get('bio'), slug: form.get('slug') });
      setProfile(saved); toast.success('تم حفظ الملف العام');
    } catch (error: any) { toast.error(error.message || 'تعذر حفظ الملف'); }
  };
  const content = tab === 'articles' ? articles : courses;
  return <div className="layout-modern py-10"><div className="container-modern max-w-5xl">
    <div className="flex flex-wrap justify-between gap-4 mb-6"><div><h1 className="text-3xl font-bold">لوحة الكاتب</h1><p className="text-gray-500">إدارة مسوداتك ومتابعة المراجعة.</p></div>
      {tab === 'articles' && <Link className="btn-primary" to="/account/articles/new">كتابة مقال</Link>}
      {tab === 'courses' && <Link className="btn-primary" to="/account/courses/new">إضافة دورة</Link>}</div>
    {!(user?.role === 'doctor' && user?.verification_status === 'approved') && <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-800">يمكنك نشر مقالات عامة. لنشر المحتوى المهني والدورات، <Link className="underline font-bold" to="/register?type=doctor">أكمل توثيق حساب الطبيب</Link>.</div>}
    <div className="flex gap-2 border-b mb-6"><button onClick={() => setTab('articles')} className={`px-4 py-3 ${tab === 'articles' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}>المقالات</button><button onClick={() => setTab('courses')} className={`px-4 py-3 ${tab === 'courses' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}>الدورات</button><button onClick={() => setTab('profile')} className={`px-4 py-3 ${tab === 'profile' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}>الملف العام</button></div>
    {loading ? <p>جاري التحميل...</p> : tab === 'profile' ? <form onSubmit={saveProfile} className="bg-white rounded-2xl p-6 space-y-4 shadow-sm"><label className="block">الرابط المختصر<input name="slug" defaultValue={profile.slug} className="input-modern mt-1" /></label><label className="block">العنوان التعريفي<input name="headline" defaultValue={profile.headline} className="input-modern mt-1" /></label><label className="block">نبذة<textarea name="bio" defaultValue={profile.bio} className="input-modern mt-1 min-h-28" /></label><button className="btn-primary">حفظ</button>{profile.slug && <Link className="mr-4 text-blue-600 underline" to={`/u/${profile.slug}`}>عرض صفحتي العامة</Link>}</form> :
      <div className="space-y-3">{content.length === 0 ? <div className="bg-white rounded-2xl p-8 text-gray-500">لا يوجد محتوى بعد.</div> : content.map(item => <div key={item.id} className="bg-white rounded-2xl p-5 shadow-sm flex flex-wrap justify-between gap-4"><div><h2 className="font-bold text-lg">{item.title}</h2><span className="text-sm text-gray-500">{statusLabel[item.status] || item.status}</span>{item.rejection_reason && <p className="text-red-700 mt-2">سبب الرفض: {item.rejection_reason}</p>}{item.status === 'approved' && item.share_token && <p className="mt-2 text-sm text-green-700 break-all">رابط المشاركة: {`${window.location.origin}/p/${item.share_token}`}</p>}</div><div className="flex gap-2">{item.status !== 'approved' && <button className="btn-secondary" onClick={() => submit(item.id, tab === 'articles' ? 'article' : 'course')}>إرسال للمراجعة</button>}{tab === 'articles' && <Link className="btn-secondary" to={`/account/articles/${item.id}/edit`}>تعديل</Link>}</div></div>)}</div>}
  </div></div>;
}
