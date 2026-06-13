import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ChevronLeft, Loader } from 'lucide-react';
import { useAllFeaturedContent } from '../../hooks/useArticles';
import { FeaturedContent } from '../../types';

interface HeroCarouselProps {
  variant?: 'dynamic' | 'static';
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({ variant = 'static' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data: dynamicArticles = [], isLoading } = useAllFeaturedContent();

  const staticFeatures = useMemo(() => [
    {
      id: 'feature-articles',
      type: 'article',
      title: 'المقالات الطبية المتخصصة',
      excerpt: 'اكتشف أحدث المقالات الطبية الموثوقة والمعتمدة في مختلف تخصصات طب الأسنان بأسلوب علمي رصين.',
      author: 'قسم المقالات',
      path: '/articles'
    },
    {
      id: 'feature-courses',
      type: 'course',
      title: 'الدورات التدريبية المعتمدة',
      excerpt: 'عزز مسيرتك المهنية واكتسب مهارات جديدة عبر دورات طبية متخصصة تحت إشراف نخبة من الخبراء.',
      author: 'قسم الدورات',
      path: '/courses'
    },
    {
      id: 'feature-cases',
      type: 'clinical_case',
      title: 'الحالات السريرية الموثقة',
      excerpt: 'استعرض وشارك حالات سريرية واقعية ومميزة مع خطط العلاج والمناقشات العلمية التفصيلية.',
      author: 'قسم الحالات',
      path: '/clinical-cases'
    },
    {
      id: 'feature-research',
      type: 'research',
      title: 'الأبحاث العلمية الحديثة',
      excerpt: 'تصفح أحدث الأبحاث والدراسات العلمية المنشورة لتبقى على اطلاع بآخر التطورات الطبية.',
      author: 'قسم الأبحاث',
      path: '/research-topics'
    }
  ] as FeaturedContent[], []);

  const articles = variant === 'static' ? staticFeatures : dynamicArticles;
  const showLoader = variant === 'dynamic' && isLoading;

  useEffect(() => {
    if (articles.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % articles.length);
      }, 4500); // Rotate every 4.5 seconds
      return () => clearInterval(interval);
    }
  }, [articles.length, currentIndex]); // Reset interval when manual slide

  const nextSlide = () => {
    if (articles.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % articles.length);
    }
  };

  const prevSlide = () => {
    if (articles.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + articles.length) % articles.length);
    }
  };

  if (showLoader) {
    return (
      <div className="relative mt-8 w-full max-w-md mx-auto lg:ml-auto lg:mr-0 group">
        <div className="relative h-[160px] md:h-[180px] w-full overflow-hidden rounded-3xl bg-white/50 backdrop-blur-md border border-gray-100 flex items-center justify-center">
          <Loader className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return null;
  }

  return (
    <div className="relative mt-8 w-full max-w-md mx-auto lg:ml-auto lg:mr-0 group z-10">

      {/* Carousel Container */}
      <div className="relative h-[160px] md:h-[180px] w-full overflow-hidden rounded-3xl">
        {articles.map((item: FeaturedContent, idx: number) => {
          const isActive = idx === currentIndex;
          const isPrev = idx === (currentIndex - 1 + articles.length) % articles.length;
          const isNext = idx === (currentIndex + 1) % articles.length;

          let transformClass = 'translate-y-full opacity-0 scale-95';
          if (isActive) transformClass = 'translate-y-0 opacity-100 scale-100 z-10';
          else if (isPrev) transformClass = '-translate-y-full opacity-0 scale-95';
          else if (isNext) transformClass = 'translate-y-full opacity-0 scale-95';

          // Background variety based on index matching existing design elements
          const bgColors = ['bg-blue-50', 'bg-purple-50', 'bg-green-50', 'bg-orange-50'];
          const textColors = ['text-blue-600', 'text-purple-600', 'text-green-600', 'text-orange-600'];
          const borderColors = ['border-blue-100', 'border-purple-100', 'border-green-100', 'border-orange-100'];
          const hoverBorderColors = ['group-hover:border-blue-300', 'group-hover:border-purple-300', 'group-hover:border-green-300', 'group-hover:border-orange-300'];

          const colorIdx = idx % 4;
          const bgClass = bgColors[colorIdx];
          const textClass = textColors[colorIdx];
          const borderClass = borderColors[colorIdx];
          const hoverBorderClass = hoverBorderColors[colorIdx];

          // Display accurate label
          const getTypeLabel = (type: string) => {
            switch (type) {
              case 'article': return 'ميزة المنصة';
              case 'clinical_case': return 'ميزة المنصة';
              case 'course': return 'ميزة المنصة';
              case 'research': return 'ميزة المنصة';
              default: return 'مميز';
            }
          }

          // Override for dynamic items
          const getDynamicTypeLabel = (type: string) => {
            switch (type) {
              case 'article': return 'مقال مميز';
              case 'clinical_case': return 'حالة سريرية';
              case 'course': return 'دورة تدريبية';
              case 'research': return 'بحث علمي';
              default: return 'مميز';
            }
          }

          const label = variant === 'static' ? getTypeLabel(item.type) : getDynamicTypeLabel(item.type);

          return (
            <Link
              key={`${item.id}-${idx}`}
              to={item.path}
              className={`absolute inset-0 flex flex-col p-6 bg-white/90 backdrop-blur-md shadow-sm border ${borderClass} ${hoverBorderClass} transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] rounded-3xl ${transformClass}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex flex-shrink-0 items-center justify-center overflow-hidden shadow-inner transition-transform duration-500 group-hover:scale-110 ${!item.author_image ? `${bgClass} ${textClass} font-bold text-xl border border-blue-100/50` : ''}`}>
                  {item.author_image ? (
                    <img src={item.author_image} alt={item.author} className="w-full h-full object-cover" />
                  ) : (
                    <span>{item.author?.charAt(0) || 'م'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 mx-3 pt-1">
                  <div className="text-xs font-bold text-gray-500 truncate">{item.author}</div>
                  <div className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1 ${bgClass} ${textClass}`}>
                    {label}
                  </div>
                </div>
                <div className="bg-gray-50 p-2 flex-shrink-0 text-gray-400 rounded-full group-hover:bg-gray-900 group-hover:text-white transition-colors duration-300">
                  <ArrowLeft size={18} className="transform group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>
              <h3 className="text-lg md:text-xl font-extrabold text-gray-900 mb-1 truncate">{item.title}</h3>
              <p className="text-xs md:text-sm text-gray-500 font-medium leading-relaxed line-clamp-1 md:line-clamp-2">{item.excerpt}</p>
            </Link>
          );
        })}
      </div>

      {/* Navigation Indicators */}
      {articles.length > 1 && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
          {articles.map((_: unknown, idx: number) => (
            <button
              key={idx}
              onClick={(e) => { e.preventDefault(); setCurrentIndex(idx); }}
              className={`transition-all duration-300 rounded-full ${idx === currentIndex ? 'w-6 h-1.5 bg-blue-600' : 'w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400'
                }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Manual Controls - Visible on Hover */}
      {articles.length > 1 && (
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
      )}

    </div>
  );
};

export default HeroCarousel;

