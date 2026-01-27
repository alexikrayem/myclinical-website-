import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Calendar, User, FileText, ChevronRight, Eye, BookOpen, Quote } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { researchApi } from '../lib/api';
import PdfViewer from '../components/research/PdfViewer';
import ShareButtons from '../components/article/ShareButtons';
import { useAuth } from '../context/AuthContext';

const ResearchDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [research, setResearch] = useState<any | null>(null);
    const [relatedPapers, setRelatedPapers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'abstract' | 'full'>('abstract');

    useEffect(() => {
        const fetchResearch = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const data = await researchApi.getById(id);
                setResearch(data);

                // Fetch related papers
                const related = await researchApi.getRelated(id);
                setRelatedPapers(related);
            } catch (error) {
                console.error('Error fetching research:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchResearch();
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [id]);

    if (loading) {
        return (
            <div className="layout-modern py-12">
                <div className="container-modern">
                    <div className="animate-pulse space-y-8">
                        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-64 bg-gray-200 rounded-3xl"></div>
                        <div className="space-y-4">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!research) {
        return (
            <div className="layout-modern py-12">
                <div className="container-modern text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText size={32} className="text-gray-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">البحث غير موجود</h1>
                    <Link to="/research-topics" className="btn-primary inline-flex items-center">
                        <ChevronRight size={18} className="ml-2" />
                        العودة للأبحاث
                    </Link>
                </div>
            </div>
        );
    }

    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const formattedDate = format(new Date(research.publication_date), 'dd MMMM yyyy', { locale: ar });

    return (
        <div className="layout-modern py-12">
            <Helmet>
                <title>{research.title} | أبحاث طبيب</title>
                <meta name="description" content={research.abstract?.slice(0, 160)} />
                <meta property="og:title" content={research.title} />
                <meta property="og:description" content={research.abstract?.slice(0, 160)} />
                <meta property="og:type" content="article" />
            </Helmet>

            <div className="container-modern">
                {/* Breadcrumbs */}
                <nav className="flex items-center space-x-2 space-x-reverse text-sm text-gray-500 mb-8">
                    <Link to="/" className="hover:text-blue-600">الرئيسية</Link>
                    <ChevronRight size={14} className="transform rotate-180" />
                    <Link to="/research-topics" className="hover:text-blue-600">الأبحاث</Link>
                    <ChevronRight size={14} className="transform rotate-180" />
                    <span className="text-gray-800 truncate max-w-xs">{research.title}</span>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white rounded-3xl p-8 card-shadow border border-gray-100">
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                    {research.journal}
                                </span>
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                    بحث علمي
                                </span>
                            </div>

                            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6 leading-tight">
                                {research.title}
                            </h1>

                            <div className="flex flex-wrap items-center gap-6 text-gray-600 mb-8 pb-8 border-b border-gray-100">
                                <div className="flex items-center">
                                    <User size={18} className="ml-2 text-blue-500" />
                                    <span>
                                        {Array.isArray(research.authors)
                                            ? research.authors.join('، ')
                                            : research.authors}
                                    </span>
                                </div>
                                <div className="flex items-center">
                                    <Calendar size={18} className="ml-2 text-blue-500" />
                                    <span>{formattedDate}</span>
                                </div>
                            </div>

                            {/* Abstract */}
                            <div className="mb-8">
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                    <Quote size={20} className="ml-2 text-blue-500" />
                                    ملخص البحث
                                </h2>
                                <p className="text-gray-700 leading-relaxed text-lg bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                    {research.abstract}
                                </p>
                            </div>

                            {/* View Mode Toggle */}
                            <div className="flex items-center justify-center space-x-4 space-x-reverse mb-8">
                                <button
                                    onClick={() => setViewMode('abstract')}
                                    className={`px-6 py-3 rounded-xl font-medium transition-all ${viewMode === 'abstract'
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    نظرة عامة
                                </button>
                                <button
                                    onClick={() => setViewMode('full')}
                                    className={`px-6 py-3 rounded-xl font-medium transition-all ${viewMode === 'full'
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    عرض البحث الكامل
                                </button>
                            </div>

                            {/* PDF Viewer */}
                            {viewMode === 'full' && (
                                <div className="animate-fadeIn">
                                    <PdfViewer researchId={id!} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 card-shadow border border-gray-100 sticky top-24">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">إجراءات</h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => setViewMode('full')}
                                    className="w-full btn-primary flex items-center justify-center"
                                >
                                    <Eye size={18} className="ml-2" />
                                    قراءة البحث
                                </button>
                                <div className="pt-4 border-t border-gray-100">
                                    <ShareButtons
                                        url={currentUrl}
                                        title={research.title}
                                        description={research.abstract}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Related Research */}
                        {relatedPapers.length > 0 && (
                            <div className="bg-white rounded-2xl p-6 card-shadow border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">أبحاث ذات صلة</h3>
                                <div className="space-y-4">
                                    {relatedPapers.map((paper) => (
                                        <Link
                                            key={paper.id}
                                            to={`/research/${paper.id}`}
                                            className="block group"
                                        >
                                            <h4 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2 mb-1">
                                                {paper.title}
                                            </h4>
                                            <div className="text-xs text-gray-500 flex items-center">
                                                <BookOpen size={12} className="ml-1" />
                                                {paper.journal}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResearchDetailPage;
