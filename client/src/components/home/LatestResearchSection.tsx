import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { useLatestResearch } from '../../hooks/useArticles';
import ResearchCard from './ResearchCard';

const LatestResearchSection: React.FC = () => {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    // IntersectionObserver: trigger fetch when section enters viewport
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '200px' } // Start loading 200px before it enters viewport
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const { data, isLoading } = useLatestResearch(isVisible ? 4 : 0);
    // Note: useLatestResearch should handle 0 limit or we can pass undefined to disable it
    // But since it's a hook, we must call it. If isVisible is false, we can pass a value that results in no fetch.

    const papers = data?.data || [];

    if (!isVisible) {
        return <section ref={sentinelRef} className="py-16 min-h-[300px]" />;
    }

    if (isLoading) {
        return (
            <section className="py-16 bg-white">
                <div className="container-modern">
                    <div className="text-right mb-10">
                        <div className="skeleton h-8 w-48 mb-3 mr-auto" style={{ marginRight: 0 }} />
                        <div className="skeleton h-4 w-72" style={{ marginRight: 0 }} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5">
                                <div className="skeleton h-4 w-20 mb-3" />
                                <div className="skeleton h-5 w-full mb-2" />
                                <div className="skeleton h-4 w-3/4 mb-3" />
                                <div className="skeleton h-3 w-1/3" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (papers.length === 0) return null;

    return (
        <section className="py-16 bg-white relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-10 right-10 w-72 h-72 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-10 left-10 w-56 h-56 bg-purple-50 rounded-full blur-3xl opacity-50" />
            </div>

            <div className="container-modern relative z-10">
                {/* Section Header */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
                    <div className="text-right w-full">
                        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-800 rounded-full px-4 py-1.5 mb-4">
                            <FlaskConical className="w-4 h-4" />
                            <span className="text-sm font-medium">أحدث الأبحاث</span>
                        </div>
                        <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
                            الأبحاث <span className="text-transparent bg-clip-text bg-gradient-to-l from-indigo-600 to-purple-600">العلمية</span>
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl ml-auto">
                            أحدث الأبحاث والدراسات العلمية المنشورة في المجلات المعتمدة
                        </p>
                    </div>

                    <Link
                        to="/research-topics"
                        className="inline-flex items-center btn-secondary whitespace-nowrap"
                    >
                        عرض كل الأبحاث
                        <ArrowLeft size={18} className="mr-2" />
                    </Link>
                </div>

                {/* Research Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {papers.map((paper: { id: string; title: string; journal?: string; abstract?: string; publication_date: string; authors?: string | string[] }) => (
                        <ResearchCard key={paper.id} paper={paper} />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default React.memo(LatestResearchSection);
