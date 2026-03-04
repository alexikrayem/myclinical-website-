import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, BookOpen, ArrowLeft } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ResearchPaper {
    id: string;
    title: string;
    journal?: string;
    abstract?: string;
    publication_date: string;
    authors?: string | string[];
}

interface ResearchCardProps {
    paper: ResearchPaper;
}

const ResearchCard: React.FC<ResearchCardProps> = ({ paper }) => {
    const formattedDate = paper.publication_date
        ? formatDistance(new Date(paper.publication_date), new Date(), { addSuffix: true, locale: ar })
        : '';

    const truncatedAbstract = paper.abstract
        ? paper.abstract.length > 120
            ? paper.abstract.substring(0, 120) + '...'
            : paper.abstract
        : '';

    const authorText = Array.isArray(paper.authors)
        ? paper.authors.slice(0, 2).join('، ')
        : paper.authors || '';

    return (
        <Link
            to={`/research-topics/${paper.id}`}
            className="group block bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300"
        >
            <div className="flex items-start justify-between mb-3">
                {paper.journal && (
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
                        {paper.journal}
                    </span>
                )}
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 mr-auto">
                    <BookOpen size={16} className="text-white" />
                </div>
            </div>

            <h4 className="text-base font-bold text-gray-900 mb-2 line-clamp-2 leading-relaxed group-hover:text-blue-700 transition-colors text-right">
                {paper.title}
            </h4>

            {truncatedAbstract && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed text-right">
                    {truncatedAbstract}
                </p>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="text-indigo-600 group-hover:text-indigo-700 transition-colors">
                    <ArrowLeft size={18} className="transform group-hover:-translate-x-1 transition-transform" />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                    {authorText && (
                        <span className="font-medium text-gray-500 truncate max-w-[120px]">{authorText}</span>
                    )}
                    {formattedDate && (
                        <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formattedDate}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default React.memo(ResearchCard);
