import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { creatorApi } from '../../lib/api';

export default function CourseSubmitPage() {
  const navigate = useNavigate(); const [form, setForm] = useState({ title: '', description: '', cover_image: '', categories: '', playback_source: '', duration: '0' });
  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => { event.preventDefault(); try { await creatorApi.createCourse({ ...form, categories: form.categories.split(',').map(item => item.trim()).filter(Boolean) }); toast.success('تم حفظ مسودة الدورة'); navigate('/account'); } catch (error: any) { toast.error(error.message || 'تعذر حفظ الدورة'); } };
  return <div className="layout-modern py-10"><form onSubmit={save} className="container-modern max-w-3xl bg-white rounded-2xl shadow-sm p-6 space-y-4"><h1 className="text-2xl font-bold">إضافة دورة</h1><input required placeholder="عنوان الدورة" className="input-modern" value={form.title} onChange={e => set('title', e.target.value)} /><textarea required placeholder="وصف الدورة" className="input-modern min-h-32" value={form.description} onChange={e => set('description', e.target.value)} /><input placeholder="رابط صورة الغلاف" className="input-modern" value={form.cover_image} onChange={e => set('cover_image', e.target.value)} /><input placeholder="التصنيفات" className="input-modern" value={form.categories} onChange={e => set('categories', e.target.value)} /><input placeholder="رابط الفيديو" className="input-modern" value={form.playback_source} onChange={e => set('playback_source', e.target.value)} /><button className="btn-primary">حفظ كمسودة</button></form></div>;
}
