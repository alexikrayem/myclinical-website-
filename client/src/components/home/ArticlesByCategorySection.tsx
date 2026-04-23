import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Tag as TagIcon } from 'lucide-react';
import { useArticles } from '../../hooks/useArticles';
import ArticleCard from '../article/ArticleCard';

interface Article {
    id: string;
    title: string;
    slug?: string;
    excerpt: string;
    cover_image: string;
    publication_date: string;
    author: string;
    tags: string[];
    is_featured?: boolean;
    article_type?: 'article' | 'clinical_case';
}

interface ArticlesByCategorySectionProps {
    tag: string;
    isPriority?: boolean;
    excludeIds?: string[];
    onItemsLoaded?: (items: { id: string }[]) => void;
}

const ArticlesByCategorySection: React.FC<ArticlesByCategorySectionProps> = ({ tag, isPriority = false, excludeIds = [], onItemsLoaded }) => {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(isPriority); // Priority tags load immediately

    // IntersectionObserver: trigger fetch when section enters viewport
    useEffect(() => {
        if (isVisible) return; // Already visible, no need to observe
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
    }, [isVisible]);

    // Only fetch when visible
    const { data: response, isLoading } = useArticles(
        isVisible ? { tag, limit: 5 } : undefined
    );

    const articles: Article[] = React.useMemo(() => {
        if (!isVisible) return [];
        const raw = response?.data || response;
        const all = Array.isArray(raw) ? raw : [];
        // Filter out already displayed articles
        return all.filter(a => !excludeIds.includes(a.id));
    }, [response, isVisible, excludeIds]);

    useEffect(() => {
        if (articles.length > 0 && onItemsLoaded) {
            onItemsLoaded(articles);
        }
    }, [articles, onItemsLoaded]);

    // Skeleton loader
    if (isVisible && isLoading) {
        return (
            <section className="py-16 bg-white relative overflow-hidden">
                <div className="container-modern relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
                        <div className="text-right w-full">
                            <div className="skeleton h-8 w-48 mb-4 mr-auto" style={{ marginRight: 0 }} />
                            <div className="skeleton h-12 w-64 mb-4 mr-auto" style={{ marginRight: 0 }} />
                            <div className="skeleton h-6 w-80 mr-auto" style={{ marginRight: 0 }} />
                        </div>
                        <div className="skeleton h-12 w-40 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                                <div className="skeleton h-56 w-full" />
                                <div className="p-6 space-y-4">
                                    <div className="skeleton h-4 w-1/4 rounded" />
                                    <div className="skeleton h-7 w-3/4 rounded" />
                                    <div className="skeleton h-4 w-full rounded" />
                                    <div className="skeleton h-4 w-5/6 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // Not visible yet — just render a lightweight sentinel div
    if (!isVisible) {
        return <div ref={sentinelRef} className="py-8 min-h-[100px]" />;
    }

    // No articles for this tag
    if (articles.length === 0) return null;

    return (
        <section className="py-16 bg-white relative overflow-hidden">
            {/* Decorative background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className={`absolute top-20 ${Math.random() > 0.5 ? 'left-10' : 'right-10'} w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-40`}></div>
                <div className={`absolute bottom-20 ${Math.random() > 0.5 ? 'right-10' : 'left-10'} w-80 h-80 bg-indigo-50 rounded-full blur-3xl opacity-40`}></div>
            </div>

            <div className="container-modern relative z-10">
                {/* Section Header */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
                    <div className="text-right w-full">
                        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 rounded-full px-4 py-1.5 mb-4">
                            <TagIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">أحدث المقالات في قسم</span>
                        </div>
                        <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
                            {tag} <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-600 to-indigo-600">العلمي</span>
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl ml-auto">
                            استكشف أحدث المقالات والمواضيع المتخصصة في {tag}
                        </p>
                    </div>

                    <Link
                        to={`/articles?tag=${encodeURIComponent(tag)}`}
                        className="inline-flex items-center btn-secondary whitespace-nowrap"
                    >
                        عرض جميع مقالات {tag}
                        <ArrowLeft size={18} className="mr-2" />
                    </Link>
                </div>

                {/* Articles Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {articles.map((article, index) => (
                        <div key={article.id} style={{ animationDelay: `${index * 0.08}s` }}>
                            <ArticleCard article={article} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default React.memo(ArticlesByCategorySection);
