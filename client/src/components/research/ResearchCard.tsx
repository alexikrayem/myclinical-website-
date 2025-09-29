import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Download, Users, Award, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ResearchCardProps {
  research: {
    id: string;
    title: string;
    abstract: string;
    publication_date: string;
    authors: string[];
    file_url: string;
    journal: string;
  };
}

const ResearchCard: React.FC<ResearchCardProps> = ({ research }) => {
  const navigate = useNavigate();
  
  const formattedDate = format(
    new Date(research.publication_date),
    'dd MMMM yyyy',
    { locale: ar }
  );

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation if clicking on a link or button
    if ((e.target as HTMLElement).closest('a, button')) {
      return;
    }
    
    // For now, just scroll to top since we don't have research detail pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div 
      className="bg-white rounded-2xl card-shadow group cursor-pointer transition-modern hover:scale-[1.02] animate-scaleIn"
      onClick={handleCardClick}
    >
      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <div className="inline-flex items-center bg-purple-100 text-purple-800 rounded-full px-3 py-1 text-xs font-medium mb-4">
              <Award size={12} className="ml-1" />
              بحث علمي محكم
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
              {research.title}
            </h3>
          </div>
        </div>
        
        <p className="text-gray-600 mb-6 line-clamp-3 leading-relaxed">{research.abstract}</p>
        
        <div className="mb-6">
          <div className="flex items-center text-sm text-gray-500 mb-3">
            <Users size={16} className="ml-2 text-blue-500" />
            <span className="font-medium">المؤلفون:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {research.authors.map((author, index) => (
              <span 
                key={index} 
                className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium"
              >
                {author}
              </span>
            ))}
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm text-gray-500 mb-6 pt-4 border-t border-gray-100">
          <div className="flex items-center">
            <Calendar size={16} className="ml-2 text-green-500" />
            <span className="font-medium">{formattedDate}</span>
          </div>
          <div className="text-right">
            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
              {research.journal}
            </span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to research detail when implemented
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-blue-600 hover:text-blue-700 transition-colors font-semibold flex items-center"
          >
            قراءة المزيد
            <ArrowLeft size={16} className="mr-2 transform group-hover:translate-x-1 transition-transform" />
          </button>
          
          <a 
            href={research.file_url}
            download
            className="btn-primary inline-flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={16} className="ml-2" />
            تحميل البحث
          </a>
        </div>
      </div>
    </div>
  );
};

export default ResearchCard;