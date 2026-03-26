import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Sparkles, Video, ArrowLeft, ChevronRight, ChevronLeft } from 'lucide-react';

const ENABLE_COURSES = import.meta.env.VITE_ENABLE_COURSES !== 'false';

const carouselItems = [
  { id: 'research', to: '/research-topics', icon: BookOpen, title: 'المكتبة البحثية', desc: 'تصفح أحدث الأبحاث والدراسات المعتمدة في شتى مجالات طب الأسنان.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', hoverBorder: 'group-hover:border-blue-300' },
  ...(ENABLE_COURSES ? [{ id: 'courses', to: '/courses', icon: Video, title: 'الدورات التدريبية', desc: 'طور مهاراتك العملية والسريرية من خلال دورات يقدمها نخبة من الخبراء.', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', hoverBorder: 'group-hover:border-purple-300' }] : []),
  { id: 'clinical', to: '/clinical-cases', icon: Sparkles, title: 'حالات سريرية', desc: 'شارك وناقش حالات واقعية ومميزة لتعزيز خبرتك التشخيصية والعلاجية.', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', hoverBorder: 'group-hover:border-green-300' },
  { id: 'articles', to: '/articles', icon: FileText, title: 'المقالات العلمية', desc: 'محتوى متجدد يومياً من أطباء ومختصين لنشر المعرفة الموثوقة.', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', hoverBorder: 'group-hover:border-orange-300' },
];

const HeroCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
    }, 4500); // Rotate every 4.5 seconds
    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);

  return (
    <div className="relative mt-8 w-full max-w-md mx-auto lg:ml-auto lg:mr-0 group">
      
      {/* Carousel Container */}
      <div className="relative h-[160px] md:h-[180px] w-full overflow-hidden rounded-3xl">
        {carouselItems.map((item, idx) => {
          const isActive = idx === currentIndex;
          const isPrev = idx === (currentIndex - 1 + carouselItems.length) % carouselItems.length;
          const isNext = idx === (currentIndex + 1) % carouselItems.length;

          let transformClass = 'translate-y-full opacity-0 scale-95';
          if (isActive) transformClass = 'translate-y-0 opacity-100 scale-100 z-10';
          else if (isPrev) transformClass = '-translate-y-full opacity-0 scale-95';
          else if (isNext) transformClass = 'translate-y-full opacity-0 scale-95';

          return (
            <Link
              key={item.id}
              to={item.to}
              className={`absolute inset-0 flex flex-col p-6 bg-white/90 backdrop-blur-md shadow-sm border ${item.border} ${item.hoverBorder} transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] rounded-3xl ${transformClass}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.bg} ${item.color} shadow-inner transition-transform duration-500 group-hover:scale-110`}>
                  <item.icon size={26} strokeWidth={2.5}/>
                </div>
                <div className="bg-gray-50 p-2 text-gray-400 rounded-full group-hover:bg-gray-900 group-hover:text-white transition-colors duration-300">
                  <ArrowLeft size={18} className="transform group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2">{item.desc}</p>
            </Link>
          );
        })}
      </div>

      {/* Navigation Indicators */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
        {carouselItems.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`transition-all duration-300 rounded-full ${
              idx === currentIndex ? 'w-6 h-1.5 bg-blue-600' : 'w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Manual Controls - Visible on Hover */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); nextSlide(); }}
          className="pointer-events-auto p-2 rounded-full bg-white/80 shadow-md border border-gray-100 text-gray-600 hover:text-blue-600 hover:bg-white transform translate-x-1/2 -ml-6"
        >
          <ChevronRight size={18} />
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); prevSlide(); }}
          className="pointer-events-auto p-2 rounded-full bg-white/80 shadow-md border border-gray-100 text-gray-600 hover:text-blue-600 hover:bg-white transform -translate-x-1/2 -mr-6"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

    </div>
  );
};

export default HeroCarousel;
