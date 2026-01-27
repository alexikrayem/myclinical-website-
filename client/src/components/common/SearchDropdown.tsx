import React from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText, BookOpen, ChevronLeft } from 'lucide-react';

interface SearchResult {
    id: string;
    title: string;
    type: 'article' | 'research' | 'course';
    slug?: string;
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

    return (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fadeIn">
            {loading ? (
                <div className="p-4 text-center text-gray-500">
                    <div className="animate-pulse flex justify-center items-center gap-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                </div>
            ) : results.length > 0 ? (
                <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 border-b border-gray-50 mb-1">
                        نتائج البحث المقترحة
                    </div>
                    {results.map((result) => (
                        <Link
                            key={`${result.type}-${result.id}`}
                            to={result.type === 'research' ? `/research/${result.id}` : `/articles/${result.slug || result.id}`}
                            onClick={onClose}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-blue-50 transition-colors group"
                        >
                            <div className="mt-1 text-gray-400 group-hover:text-blue-500 transition-colors">
                                {result.type === 'research' ? <BookOpen size={16} /> : <FileText size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-700 transition-colors">
                                    {result.title}
                                </h4>
                                <span className="text-xs text-gray-400">
                                    {result.type === 'research' ? 'بحث علمي' : 'مقال'}
                                </span>
                            </div>
                            <ChevronLeft size={14} className="self-center text-gray-300 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-x-1" />
                        </Link>
                    ))}
                    <Link
                        to={`/articles?search=${encodeURIComponent(searchTerm)}`}
                        onClick={onClose}
                        className="block text-center py-3 text-sm text-blue-600 hover:bg-blue-50 font-medium border-t border-gray-50 transition-colors"
                    >
                        عرض كل النتائج لـ "{searchTerm}"
                    </Link>
                </div>
            ) : (
                <div className="p-6 text-center">
                    <Search size={24} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">لا توجد نتائج لـ "{searchTerm}"</p>
                </div>
            )}
        </div>
    );
};

export default SearchDropdown;
