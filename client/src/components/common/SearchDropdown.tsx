import React from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, BookOpen, ChevronLeft, GraduationCap } from 'lucide-react';

interface SearchResult {
    id: string;
    title: string;
    type: 'article' | 'research' | 'course';
    slug?: string;
    cover_image?: string;
    excerpt?: string;
    abstract?: string;
    description?: string;
    author?: string;
    journal?: string;
    categories?: string[];
}

interface SearchDropdownProps {
    results: SearchResult[];
    loading: boolean;
    isOpen: boolean;
    onClose: () => void;
    searchTerm: string;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ results, loading, isOpen, onClose, searchTerm }) => {
    if (!isOpen || !searchTerm) return null;

    const getResultHref = (result: SearchResult) => {
        if (result.type === 'research') return `/research/${result.id}`;
        if (result.type === 'course') return `/courses/${result.id}`;
        return `/articles/${result.slug || result.id}`;
    };

    const getResultTypeLabel = (type: SearchResult['type']) => {
        if (type === 'research') return 'بحث علمي';
        if (type === 'course') return 'دورة';
        return 'مقال';
    };

    const getResultPreview = (result: SearchResult) => {
        return result.excerpt || result.abstract || result.description || result.journal || '';
    };

    const getResultMeta = (result: SearchResult) => {
        if (result.type === 'research') {
            return result.journal || 'ورقة بحثية';
        }
        if (result.type === 'course') {
            if (Array.isArray(result.categories) && result.categories.length > 0) {
                return result.categories.slice(0, 2).join(' • ');
            }
            return result.author || 'دورة تعليمية';
        }
        return result.author || 'محتوى طبي';
    };

    const getTypeBadgeClass = (type: SearchResult['type']) => {
        if (type === 'research') return 'bg-purple-100 text-purple-700 border-purple-200';
        if (type === 'course') return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-blue-100 text-blue-700 border-blue-200';
    };

    return (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fadeIn">
            {loading ? (
                <div className="p-6 text-center text-gray-500">
                    <div className="animate-pulse flex justify-center items-center gap-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">جاري تجهيز أفضل النتائج...</p>
                </div>
            ) : results.length > 0 ? (
                <div className="py-1">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500">نتائج البحث المقترحة</span>
                        <span className="text-[11px] text-gray-400">{results.length} نتيجة</span>
                    </div>
                    <div className="max-h-[24rem] overflow-y-auto">
                        {results.map((result) => (
                        <Link
                            key={`${result.type}-${result.id}`}
                            to={getResultHref(result)}
                            onClick={onClose}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-blue-50/70 transition-colors group border-b border-gray-50 last:border-b-0"
                        >
                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                                {result.cover_image ? (
                                    <img
                                        src={result.cover_image}
                                        alt={result.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-500">
                                        {result.type === 'research' && <BookOpen size={18} />}
                                        {result.type === 'course' && <GraduationCap size={18} />}
                                        {result.type === 'article' && <FileText size={18} />}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getTypeBadgeClass(result.type)}`}>
                                        {getResultTypeLabel(result.type)}
                                    </span>
                                    <span className="text-[11px] text-gray-400 truncate">{getResultMeta(result)}</span>
                                </div>

                                <h4 className="text-sm font-semibold text-gray-800 line-clamp-1 group-hover:text-blue-700 transition-colors">
                                    {result.title}
                                </h4>

                                {getResultPreview(result) && (
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-relaxed">
                                        {getResultPreview(result)}
                                    </p>
                                )}
                            </div>

                            <ChevronLeft size={14} className="self-center text-gray-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-x-1 mt-1" />
                        </Link>
                        ))}
                    </div>

                    <Link
                        to={`/articles?search=${encodeURIComponent(searchTerm)}`}
                        onClick={onClose}
                        className="block text-center py-3 text-sm text-blue-600 hover:bg-blue-50 font-semibold border-t border-gray-100 transition-colors"
                    >
                        عرض كل النتائج لـ "{searchTerm}"
                    </Link>
                </div>
            ) : (
                <div className="p-8 text-center">
                    <Search size={24} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">لا توجد نتائج لـ "{searchTerm}"</p>
                    <p className="text-xs text-gray-400 mt-2">جرّب كلمة أقصر أو مصطلح مختلف</p>
                </div>
            )}
        </div>
    );
};

export default SearchDropdown;
