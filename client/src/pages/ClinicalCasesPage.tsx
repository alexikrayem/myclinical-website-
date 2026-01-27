import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import ArticleCard from '../components/article/ArticleCard';
import { Search, Filter, Stethoscope } from 'lucide-react';
import ArticleListSkeleton from '../components/loaders/ArticleListSkeleton';

const ClinicalCasesPage: React.FC = () => {
    const [cases, setCases] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [allTags, setAllTags] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCases, setTotalCases] = useState(0);

    useEffect(() => {
        // Fetch unique tags for filtering
        const fetchTags = async () => {
            try {
                const response = await api.get('/articles/tags');
                setAllTags(response.data || []);
            } catch (error) {
                console.error('Error fetching tags:', error);
            }
        };
        fetchTags();
    }, []);

    useEffect(() => {
        const fetchCases = async () => {
            try {
                setLoading(true);
                // Fetch articles with type='clinical_case'
                const response = await api.get('/articles', {
                    params: {
                        page,
                        limit: 9,
                        search: searchQuery,
                        tag: selectedTag,
                        type: 'clinical_case'
                    }
                });

                setCases(response.data.data || []);
                setTotalPages(response.data.pagination.pages);
                setTotalCases(response.data.pagination.total);
            } catch (error) {
                console.error('Error fetching cases:', error);
            } finally {
                setLoading(false);
            }
        };

        // Debounce search
        const timeoutId = setTimeout(() => {
            fetchCases();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [page, searchQuery, selectedTag]);

    return (
        <div className="layout-modern py-12">
            <div className="container-modern space-y-8">
                {/* Header Section */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center bg-teal-100 text-teal-800 rounded-full px-4 py-2 mb-6">
                        <Stethoscope className="w-4 h-4 ml-2" />
                        <span className="text-sm font-medium">الحالات السريرية</span>
                    </div>
                    <h1 className="heading-modern text-4xl lg:text-5xl text-gray-900 mb-4">
                        الحالات السريرية
                    </h1>
                    <p className="text-modern text-lg max-w-2xl mx-auto">
                        استعراض ودراسة حالات سريرية واقعية من ممارسات طب الأسنان المختلفة
                    </p>
                </div>

                {/* Search and Filter Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24 z-30">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="ابحث عن حالة سريرية..."
                                className="w-full pr-12 pl-4 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="relative md:w-64">
                            <Filter className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <select
                                value={selectedTag}
                                onChange={(e) => setSelectedTag(e.target.value)}
                                className="w-full pr-12 pl-4 py-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none transition-all cursor-pointer"
                            >
                                <option value="">كل التخصصات</option>
                                {allTags.map(tag => (
                                    <option key={tag} value={tag}>{tag}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Results Grid */}
                {loading ? (
                    <ArticleListSkeleton count={9} />
                ) : cases.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {cases.map((item) => (
                                <ArticleCard key={item.id} article={item} />
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center space-x-2 space-x-reverse mt-12">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                                >
                                    السابق
                                </button>
                                <div className="flex items-center space-x-2 space-x-reverse px-4">
                                    <span className="text-gray-600">صفحة {page} من {totalPages}</span>
                                </div>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                                >
                                    التالي
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
                        <Stethoscope className="mx-auto text-gray-300 mb-4" size={64} />
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">لا توجد حالات سريرية</h3>
                        <p className="text-gray-500">لم يتم العثور على حالات تطابق بحثك</p>
                        {(searchQuery || selectedTag) && (
                            <button
                                onClick={() => { setSearchQuery(''); setSelectedTag(''); }}
                                className="mt-6 btn-primary"
                            >
                                عرض كل الحالات
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClinicalCasesPage;

