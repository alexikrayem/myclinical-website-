import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Video, Sparkles, ArrowLeft } from 'lucide-react';

const ENABLE_COURSES = import.meta.env.VITE_ENABLE_COURSES !== 'false';

const TABS = [
  {
    id: 'articles',
    title: 'المقالات الحديثة',
    subtitle: 'محتوى متجدد يومياً',
    icon: BookOpen,
    image: 'https://images.pexels.com/photos/3845729/pexels-photo-3845729.jpeg?auto=compress&cs=tinysrgb&w=800',
    link: '/articles',
    cta: 'استكشف المقالات',
    colorText: 'text-blue-600',
    colorBg: 'bg-blue-100',
    borderTop: 'bg-blue-500'
  },
  ...(ENABLE_COURSES ? [{
    id: 'courses',
    title: 'الدورات المعتمدة',
    subtitle: 'طور مهاراتك العملية',
    icon: Video,
    image: 'https://images.pexels.com/photos/3845625/pexels-photo-3845625.jpeg?auto=compress&cs=tinysrgb&w=800',
    link: '/courses',
    cta: 'تصفح الدورات',
    colorText: 'text-purple-600',
    colorBg: 'bg-purple-100',
    borderTop: 'bg-purple-500'
  }] : []),
  {
    id: 'clinical',
    title: 'حالات سريرية',
    subtitle: 'تشخيص ومعالجة واقعية',
    icon: Sparkles,
    image: 'https://images.pexels.com/photos/3779702/pexels-photo-3779702.jpeg?auto=compress&cs=tinysrgb&w=800',
    link: '/clinical-cases',
    cta: 'ناقش الحالات',
    colorText: 'text-teal-600',
    colorBg: 'bg-teal-100',
    borderTop: 'bg-teal-500'
  }
];

const RotatingDentalImages: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-rotate tabs if not hovered
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % TABS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isHovered]);

  return (
    <div 
      className="relative w-full h-full p-2 perspective-1000 flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
       {/* Background Glow */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-100/50 to-purple-100/50 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
       
       {/* Main Display Area (Top chunk) */}
       <div className="relative flex-1 rounded-[32px] overflow-hidden shadow-2xl border border-white/60 bg-white group mb-4">
         {TABS.map((tab, idx) => (
           <div 
             key={tab.id}
             className={`absolute inset-0 transition-all duration-700 ease-in-out ${idx === activeTab ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105 pointer-events-none'}`}
           >
             <img src={tab.image} alt={tab.title} className="w-full h-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-[2000ms]" />
             <div className="absolute inset-0 bg-gradient-to-t from-gray-900/95 via-gray-900/40 to-transparent"></div>
             
             <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-start text-right">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md bg-white/20 text-white text-sm font-semibold mb-3 border border-white/30`}>
                   <tab.icon size={16} />
                   <span>{tab.subtitle}</span>
                </div>
                <h3 className="text-3xl md:text-5xl font-extrabold text-white mb-2 leading-tight drop-shadow-md">
                  {tab.title}
                </h3>
                <p className="text-gray-200 mb-6 text-lg max-w-sm drop-shadow-sm font-medium">
                  استكشف أحدث ما توصل إليه طب الأسنان من خلال هذه الزاوية المتخصصة.
                </p>
                <Link 
                  to={tab.link}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all duration-300 transform group-hover:-translate-y-1 bg-white hover:bg-gray-50 shadow-lg ${tab.colorText}`}
                >
                  {tab.cta}
                  <ArrowLeft size={20} className="mr-1 transform group-hover:-translate-x-1 transition-transform" />
                </Link>
             </div>
           </div>
         ))}
       </div>

       {/* Tabs Navigation */}
       <div className="h-28 flex gap-3">
         {TABS.map((tab, idx) => (
           <button
             key={tab.id}
             onClick={() => setActiveTab(idx)}
             className={`flex-1 relative rounded-2xl p-2 md:p-4 overflow-hidden border transition-all duration-300 flex flex-col items-center justify-center gap-2 group outline-none ${
               idx === activeTab 
                 ? 'bg-white shadow-lg border-gray-200 scale-100 translate-y-0' 
                 : 'bg-white/60 backdrop-blur-md shadow-sm border-white/40 scale-[0.98] hover:bg-white/90 hover:scale-100 hover:-translate-y-0.5'
             }`}
           >
             {/* Active Line Indicator */}
             <div className={`absolute top-0 left-0 right-0 h-1.5 transition-opacity duration-300 ${tab.borderTop} ${idx === activeTab ? 'opacity-100' : 'opacity-0'}`}></div>
             
             <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${
                 idx === activeTab 
                   ? `${tab.colorBg} ${tab.colorText}` 
                   : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700'
               }`}>
                <tab.icon size={20} />
             </div>
             <span className={`text-[11px] md:text-sm font-bold text-center leading-tight transition-colors duration-300 ${idx === activeTab ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}`}>
               {tab.title}
             </span>
           </button>
         ))}
       </div>
    </div>
  );
};

export default RotatingDentalImages;
