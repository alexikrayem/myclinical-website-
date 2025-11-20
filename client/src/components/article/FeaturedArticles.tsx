import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Loader } from 'lucide-react';
import ArticleCard from './ArticleCard';
import { useFeaturedArticles } from '../../hooks/useArticles';

const FeaturedArticles: React.FC = () => {
  const { data: articles = [], isLoading: loading } = useFeaturedArticles();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance slides
  useEffect(() => {
    if (articles.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev === articles.length - 1 ? 0 : prev + 1));
      }, 6000);

      return () => clearInterval(interval);
    }
  }, [articles.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === articles.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? articles.length - 1 : prev - 1));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-3xl card-shadow">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">جاري تحميل المقالات المميزة...</p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-3xl card-shadow">
        <p className="text-gray-500">لا توجد مقالات مميزة متاحة حالياً</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-3xl">
        {articles.map((article: any, index: number) => (
          <div
            key={article.id}
            className={`transition-all duration-700 ease-in-out ${index === currentSlide
              ? 'opacity-100 transform translate-x-0'
              : 'opacity-0 absolute top-0 left-0 right-0 transform translate-x-full'
              }`}
          >
            {index === currentSlide && <ArticleCard article={article} featured={true} />}
          </div>
        ))}

        {articles.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-6 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white text-gray-800 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-20 backdrop-blur-sm"
              aria-label="Previous slide"
            >
              <ChevronLeft size={20} className="mx-auto" />
            </button>

            <button
              onClick={nextSlide}
              className="absolute right-6 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white text-gray-800 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-20 backdrop-blur-sm"
              aria-label="Next slide"
            >
              <ChevronRight size={20} className="mx-auto" />
            </button>

            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
              {articles.map((_: any, index: number) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentSlide
                    ? 'bg-white scale-125'
                    : 'bg-white/50 hover:bg-white/75'
                    }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FeaturedArticles;