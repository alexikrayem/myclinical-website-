import React, { useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileText, Sparkles, TrendingUp, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import FeaturedArticles from '../components/article/FeaturedArticles';
import ArticleList from '../components/article/ArticleList';
import { useTags } from '../hooks/useArticles';

const HomePage: React.FC = () => {
  const { data: tags = [] } = useTags();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getTagImage = (tag: string) => {
    // Map tags to specific high-quality images
    const imageMap: { [key: string]: string } = {
      'جراحة': 'https://images.pexels.com/photos/3845729/pexels-photo-3845729.jpeg?auto=compress&cs=tinysrgb&w=800',
      'تقويم': 'https://images.pexels.com/photos/11643390/pexels-photo-11643390.jpeg?auto=compress&cs=tinysrgb&w=800',
      'زراعة': 'https://images.pexels.com/photos/3845625/pexels-photo-3845625.jpeg?auto=compress&cs=tinysrgb&w=800',
      'تجميل': 'https://images.pexels.com/photos/3779702/pexels-photo-3779702.jpeg?auto=compress&cs=tinysrgb&w=800',
      'أطفال': 'https://images.pexels.com/photos/5355899/pexels-photo-5355899.jpeg?auto=compress&cs=tinysrgb&w=800',
      'لثة': 'https://images.pexels.com/photos/4269272/pexels-photo-4269272.jpeg?auto=compress&cs=tinysrgb&w=800',
      'عصب': 'https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=800',
      'وقاية': 'https://images.pexels.com/photos/3845548/pexels-photo-3845548.jpeg?auto=compress&cs=tinysrgb&w=800',
      'تبييض': 'https://images.pexels.com/photos/6502308/pexels-photo-6502308.jpeg?auto=compress&cs=tinysrgb&w=800',
      'تركيبات': 'https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=800',
    };

    // Check for partial matches if exact match fails
    for (const key in imageMap) {
      if (tag.includes(key)) return imageMap[key];
    }

    // Default images for random assignment to keep variety
    const defaults = [
      'https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/305565/pexels-photo-305565.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3845548/pexels-photo-3845548.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3779708/pexels-photo-3779708.jpeg?auto=compress&cs=tinysrgb&w=800'
    ];

    // Deterministic random based on tag string length
    return defaults[tag.length % defaults.length];
  };

  const categories = useMemo(() => {
    if (!tags.length) return [];
    return tags.map((tag: string) => ({
      id: tag,
      name: tag,
      image: getTagImage(tag)
    }));
  }, [tags]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320; // Approximate card width + gap
      const newScrollLeft = scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="layout-modern">
      {/* Hero Section */}
      {/* Modern Hero Section */}
      <section className="hero-modern relative overflow-hidden flex items-center justify-center min-h-[80vh] text-white">
        {/* Animated Floating Lights */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/30 rounded-full blur-3xl animate-float-delayed"></div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-800/70 via-indigo-900/80 to-purple-900/80 z-0"></div>

        {/* Dotted Pattern */}
        <div className="absolute inset-0 pattern-dots opacity-20 z-0"></div>

        <div className="container-modern relative z-10 text-center px-6 animate-fadeIn">
          {/* Tagline */}
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md rounded-full px-6 py-2 mb-6 border border-white/20 shadow-lg transition-modern hover:scale-105">
            <Sparkles className="w-5 h-5 text-blue-200 animate-pulse" />
            <span className="text-sm font-medium tracking-wide">منصة طب الأسنان الرائدة</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight drop-shadow-xl mb-6">
            <span className="block text-white">منصة طب الأسنان</span>
            <span className="block bg-gradient-to-r from-blue-300 via-indigo-300 to-purple-300 bg-clip-text text-transparent">
              العربي
            </span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-2xl text-blue-100/90 mb-10 leading-relaxed max-w-3xl mx-auto">
            موسوعة متكاملة من المقالات والأبحاث العلمية المتخصصة
            <br />
            في مجال طب الأسنان باللغة العربية
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/articles"
              className="btn-primary inline-flex items-center justify-center text-lg px-8 py-4 rounded-xl shadow-lg hover:-translate-y-1 transition-modern"
            >
              <BookOpen size={22} className="ml-3" />
              استكشف المقالات
            </Link>

            <Link
              to="/research-topics"
              className="btn-secondary inline-flex items-center justify-center text-lg px-8 py-4 rounded-xl shadow-lg hover:-translate-y-1 transition-modern backdrop-blur-md"
            >
              <FileText size={22} className="ml-3" />
              تصفح الأبحاث
            </Link>
          </div>
        </div>

        {/* Decorative wave divider */}
        <svg
          className="absolute bottom-0 left-0 w-full text-white/10"
          viewBox="0 0 1440 320"
          fill="currentColor"
        >
          <path d="M0,224L60,197.3C120,171,240,117,360,128C480,139,600,213,720,224C840,235,960,181,1080,154.7C1200,128,1320,128,1380,128L1440,128L1440,320L0,320Z" />
        </svg>
      </section>


      {/* Stats Section */}
      <section className="py-12 bg-white">
        <div className="container-modern">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">500+</div>
              <p className="text-gray-600">مقال متخصص</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">150+</div>
              <p className="text-gray-600">بحث علمي</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">50+</div>
              <p className="text-gray-600">خبير ومختص</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Articles */}
      <section className="py-12 bg-gray-50">
        <div className="container-modern">
          <div className="text-center mb-12">
            <div className="inline-flex items-center bg-blue-100 text-blue-800 rounded-full px-4 py-2 mb-4">
              <TrendingUp className="w-4 h-4 ml-2" />
              <span className="text-sm font-medium">المحتوى المميز</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">المقالات المميزة</h2> {/* Updated heading style */}
            <p className="text-lg text-gray-600 max-w-2xl mx-auto"> {/* Updated paragraph style */}
              اكتشف أحدث وأهم المقالات في مجال طب الأسنان من خبراء ومختصين معتمدين
            </p>
          </div>
          <FeaturedArticles />
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-white relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-50 rounded-full blur-3xl opacity-60"></div>
        </div>

        <div className="container-modern relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 px-4">
            <div className="text-right w-full">
              <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 rounded-full px-4 py-1.5 mb-4">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">تصفح حسب القسم</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
                التخصصات <span className="text-transparent bg-clip-text bg-gradient-to-l from-purple-600 to-blue-600">الطبية</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mr-auto">
                استكشف المقالات والأبحاث العلمية مصنفة حسب التخصصات الطبية الدقيقة
              </p>
            </div>

            {/* Desktop Navigation Arrows */}
            <div className="hidden md:flex gap-2 mt-4 md:mt-0">
              <button
                onClick={() => scroll('right')}
                className="p-3 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all text-gray-700"
                aria-label="Next categories"
              >
                <ChevronRight size={20} />
              </button>
              <button
                onClick={() => scroll('left')}
                className="p-3 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all text-gray-700"
                aria-label="Previous categories"
              >
                <ChevronLeft size={20} />
              </button>
            </div>
          </div>

          <div className="relative group-container">
            {/* Mobile Navigation Arrows (Overlay) */}
            <button
              onClick={() => scroll('right')}
              className="md:hidden absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-lg border border-gray-100 text-gray-700 translate-x-2"
              aria-label="Next categories"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={() => scroll('left')}
              className="md:hidden absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-lg border border-gray-100 text-gray-700 -translate-x-2"
              aria-label="Previous categories"
            >
              <ChevronLeft size={20} />
            </button>

            <div
              ref={scrollContainerRef}
              className="flex overflow-x-auto pb-12 pt-4 gap-6 snap-x hide-scrollbar px-4"
              style={{ scrollBehavior: 'smooth' }}
            >
              {categories.map((category: { id: string; name: string; image: string }) => (
                <Link
                  key={category.id}
                  to={`/articles?tag=${encodeURIComponent(category.id)}`}
                  className="group relative overflow-hidden rounded-3xl h-80 min-w-[260px] md:min-w-[300px] flex-shrink-0 snap-center transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl cursor-pointer bg-white border border-gray-100"
                >
                  {/* Image Container */}
                  <div className="absolute inset-0 h-full w-full">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    {/* Gradient Overlay - Lighter */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-70 group-hover:opacity-80 transition-opacity duration-500"></div>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay"></div>
                  </div>

                  {/* Content */}
                  <div className="absolute inset-0 p-6 flex flex-col justify-end text-right">
                    <div className="transform transition-transform duration-500 translate-y-2 group-hover:translate-y-0">
                      <div className="w-12 h-1 bg-blue-500 rounded-full mb-4 w-0 group-hover:w-12 transition-all duration-500 delay-100"></div>
                      <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-md">{category.name}</h3>
                      <p className="text-gray-200 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0 mb-4">
                        تصفح جميع المقالات المتعلقة بـ {category.name}
                      </p>

                      <div className="inline-flex items-center text-white font-medium group-hover:text-blue-300 transition-colors">
                        <span className="ml-2">عرض القسم</span>
                        <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-sm group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                          <ArrowLeft size={16} className="transform group-hover:-translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Blur indicators for scroll - Lighter/Subtle */}
            <div className="absolute top-0 right-0 w-16 h-full bg-gradient-to-l from-white via-white/50 to-transparent pointer-events-none z-10 hidden md:block opacity-80"></div>
            <div className="absolute top-0 left-0 w-16 h-full bg-gradient-to-r from-white via-white/50 to-transparent pointer-events-none z-10 hidden md:block opacity-80"></div>
          </div>
        </div>
      </section>

      {/* Latest Articles */}
      <section className="py-12 bg-gray-50">
        <div className="container-modern">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12 text-center md:text-right"> {/* Adjusted for RTL and responsiveness */}
            <div>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">أحدث المقالات</h2> {/* Updated heading style */}
              <p className="text-lg text-gray-600">آخر المقالات والموضوعات المنشورة على المنصة</p> {/* Updated paragraph style */}
            </div>
            <Link
              to="/articles"
              className="inline-flex items-center btn-secondary mt-6 md:mt-0" // Responsive margin
            >
              عرض جميع المقالات
              <ArrowLeft size={18} className="mr-2" />
            </Link>
          </div>

          <ArticleList limit={6} showFilters={false} />

          <div className="text-center mt-8 md:hidden"> {/* Hide on medium and up, show on small */}
            <Link
              to="/articles"
              className="btn-primary inline-flex items-center"
            >
              عرض جميع المقالات
              <ArrowLeft size={18} className="mr-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}

    </div>
  );
};

export default HomePage;