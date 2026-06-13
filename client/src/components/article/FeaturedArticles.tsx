import React, { useState, useEffect, useCallback } from 'react';
import { Loader, Clock, ChevronLeft, ChevronRight, Sparkles, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistance } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAllFeaturedContent } from '../../hooks/useArticles';
import { FeaturedContent } from '../../types';

interface FeaturedArticlesProps {
  onItemsLoaded?: (items: { id: string }[]) => void;
}

const FeaturedArticles: React.FC<FeaturedArticlesProps> = ({ onItemsLoaded }) => {
  const { data: articles = [], isLoading: loading } = useAllFeaturedContent();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (articles.length > 0 && onItemsLoaded) {
      onItemsLoaded(articles);
    }
  }, [articles, onItemsLoaded]);

  const nextSlide = useCallback(() => {
    if (articles.length > 0) {
      setActiveIndex((prev) => (prev + 1) % articles.length);
    }
  }, [articles.length]);

  const prevSlide = useCallback(() => {
    if (articles.length > 0) {
      setActiveIndex((prev) => (prev - 1 + articles.length) % articles.length);
    }
  }, [articles.length]);

  useEffect(() => {
    if (!isPaused && articles.length > 1) {
      const interval = setInterval(nextSlide, 6000);
      return () => clearInterval(interval);
    }
  }, [isPaused, articles.length, activeIndex, nextSlide]); // Added activeIndex to reset timer on manual slide

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-white rounded-[2.5rem] card-shadow-lg overflow-hidden border border-gray-100">
        <div className="text-center animate-pulse">
          <Loader className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">جاري تحضير المحتوى المميز...</p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">لا توجد مقالات مميزة متاحة حالياً</p>
        </div>
      </div>
    );
  }

  const handleArticleClick = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className="relative bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-blue-50/50 overflow-hidden group/container"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px] lg:h-[600px]">

        {/* RIGHT SIDE (2/3): Article Content - Shown first in source for mobile stacking if needed, but visually on right */}
        {/* We use order-first or order-last depending on RTL/LTR preferences, but user mentioned 1/3 list and 2/3 component */}
        <div className="lg:col-span-8 relative overflow-hidden group">
          {articles.map((article: FeaturedContent, idx: number) => (
            <div
              key={article.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === activeIndex ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}
            >
              {/* Background Image with Gradient Overlay */}
              <div className="absolute inset-0">
                <img
                  src={article?.cover_image || ''}
                  alt={article?.title}
                  className={`w-full h-full object-cover transition-transform duration-[3000ms] ${idx === activeIndex ? 'scale-105' : 'scale-100'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent hidden lg:block"></div>
              </div>

              {/* Content Container */}
              <div className="absolute inset-0 p-8 lg:p-12 flex flex-col justify-end text-white">
                <div className={`flex flex-col gap-4 max-w-2xl transform transition-all duration-1000 delay-300 ${idx === activeIndex ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-blue-600/90 backdrop-blur-md rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/20">
                      <Sparkles size={12} />
                      {article.type === 'clinical_case' ? 'حالة سريرية' :
                        article.type === 'course' ? 'دورة تدريبية' :
                          article.type === 'research' ? 'بحث علمي' : 'مقال مميز'}
                    </span>
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <Clock size={14} />
                      <span>{article?.publication_date ? formatDistance(new Date(article.publication_date), new Date(), { addSuffix: true, locale: ar }) : ''}</span>
                    </div>
                  </div>

                  <h2 className="text-3xl lg:text-5xl font-black mb-4 leading-[1.1] drop-shadow-lg tracking-tight">
                    {article?.title}
                  </h2>

                  <p className="text-lg lg:text-xl text-white/90 line-clamp-3 mb-8 leading-relaxed font-medium">
                    {article?.excerpt}
                  </p>

                  <div className="flex flex-wrap items-center gap-6 mt-2">
                    <button
                      onClick={() => handleArticleClick(article.path || `/articles/${article.id}`)}
                      className="group/btn px-8 py-4 bg-white text-blue-600 rounded-2xl font-bold text-lg transition-all duration-300 hover:bg-blue-50 active:scale-95 flex items-center gap-3 shadow-xl"
                    >
                      {article.type === 'course' ? 'عرض الدورة' :
                        article.type === 'research' ? 'قراءة البحث' : 'اقرأ المقال كاملاً'}
                      <ArrowLeft className="w-5 h-5 transition-transform group-hover/btn:-translate-x-1" />
                    </button>

                    {/* Progress Indicators for Mobile */}
                    <div className="flex lg:hidden items-center gap-2">
                      {articles.map((_: unknown, pageIdx: number) => (
                        <div
                          key={pageIdx}
                          className={`h-1.5 rounded-full transition-all duration-500 ${pageIdx === activeIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Navigation Arrows (visible on hover) */}
          <div className="absolute top-1/2 -translate-y-1/2 w-full px-6 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
            <button
              onClick={(e) => { e.stopPropagation(); prevSlide(); }}
              className="p-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all pointer-events-auto active:scale-90 shadow-xl"
            >
              <ChevronRight size={24} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextSlide(); }}
              className="p-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all pointer-events-auto active:scale-90 shadow-xl"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
        </div>

        {/* LEFT SIDE (1/3): Author List Sidebar */}
        <div className="lg:col-span-4 bg-gray-50/50 backdrop-blur-sm border-r lg:border-r-0 lg:border-l border-gray-100 flex flex-col p-6 lg:p-8 order-last lg:order-first">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
              أبرز الكتاب والباحثين
            </h3>
            <div className="hidden lg:flex gap-1.5">
              {articles.map((_: unknown, idx: number) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-500 ${idx === activeIndex ? 'w-6 bg-blue-600' : 'w-1.5 bg-gray-200'}`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar pr-1 flex-1">
            {articles.map((article: FeaturedContent, idx: number) => (
              <button
                key={article.id}
                onClick={() => setActiveIndex(idx)}
                className={`group flex items-center gap-4 p-4 rounded-[1.5rem] transition-all duration-500 text-right ${idx === activeIndex
                  ? 'bg-white shadow-xl shadow-blue-900/10 border border-blue-100 scale-[1.02]'
                  : 'hover:bg-white/60 border border-transparent'
                  }`}
              >
                <div className={`relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden shadow-md transition-transform duration-500 ${idx === activeIndex ? 'ring-2 ring-blue-500 ring-offset-2' : 'group-hover:scale-105'}`}>
                  {article.author_image ? (
                    <img
                      src={article.author_image}
                      alt={article.author}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold text-2xl border border-blue-200/50">
                      {article.author.charAt(0)}
                    </div>
                  )}
                  {idx === activeIndex && (
                    <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                      <Sparkles size={16} className="text-blue-600 animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`font-black text-lg truncate transition-colors ${idx === activeIndex ? 'text-blue-700' : 'text-gray-900'}`}>
                    {article.author}
                  </div>
                  <div className={`text-sm truncate mt-0.5 ${idx === activeIndex ? 'text-blue-500 font-medium' : 'text-gray-500 line-clamp-1'}`}>
                    {article.title}
                  </div>
                </div>

                {idx === activeIndex && (
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <ChevronLeft size={16} />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Bottom Call to Action */}
          <button
            onClick={() => navigate('/articles')}
            className="mt-8 py-4 px-6 bg-white border border-gray-100 rounded-2xl text-gray-600 font-bold hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all duration-300 flex items-center justify-center gap-2 group/all shadow-sm"
          >
            تصفح جميع المقالات
            <ArrowLeft className="w-4 h-4 transition-transform group-hover/all:-translate-x-1" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default FeaturedArticles;