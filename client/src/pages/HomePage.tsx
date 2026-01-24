import React, { useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileText, Sparkles, TrendingUp, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import FeaturedArticles from '../components/article/FeaturedArticles';
import ArticleList from '../components/article/ArticleList';
import { useTags } from '../hooks/useArticles';
import RotatingDentalImages from '../components/home/RotatingDentalImages';

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
      <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-[#F8FAFC]">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-[100px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-100/50 rounded-full blur-[100px] animate-pulse-slow delay-1000"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          {/* Grid Pattern */}
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.3 }}></div>
        </div>

        <div className="container-modern relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Text Content (Right) */}
            <div className="text-right order-2 lg:order-1 space-y-8">
              <div className="inline-flex items-center gap-2 bg-white border border-blue-100 shadow-sm rounded-full px-4 py-1.5 animate-fadeIn">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                <span className="text-sm font-medium text-blue-900">المنصة الأولى لأطباء الأسنان العرب</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-black text-gray-900 leading-[1.15] tracking-tight">
                ارتقِ بمستقبلك <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  المهني والعلمي
                </span>
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed max-w-2xl ml-auto">
                موسوعة متكاملة تجمع بين أحدث المقالات العلمية، الدورات التدريبية المعتمدة، والأبحاث المتخصصة في طب الأسنان.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-end pt-4">
                <Link
                  to="/courses"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-blue-600 rounded-2xl hover:bg-blue-700 hover:shadow-lg hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                >
                  <BookOpen className="ml-2 -mr-1" size={24} />
                  تصفح الدورات
                </Link>
                <Link
                  to="/articles"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-gray-700 transition-all duration-200 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 hover:shadow-md hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
                >
                  <FileText className="ml-2 -mr-1" size={24} />
                  قراءة المقالات
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-200/60">
                <div>
                  <p className="text-3xl font-bold text-gray-900">+500</p>
                  <p className="text-sm text-gray-500 mt-1">مقال علمي</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">+50</p>
                  <p className="text-sm text-gray-500 mt-1">دورة تدريبية</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">+10k</p>
                  <p className="text-sm text-gray-500 mt-1">طبيب مشترك</p>
                </div>
              </div>
            </div>

            {/* Visual Content (Left) */}
            <div className="relative order-1 lg:order-2 hidden lg:block">
              <div className="relative w-full aspect-square max-w-[600px] mx-auto">
                {/* Main Image/Shape */}
                <div className="absolute inset-0">
                  <RotatingDentalImages />
                </div>

                {/* Floating Cards - Now handled inside RotatingDentalImages for 3D effect */}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Featured Articles */}
      <section className="py-12 bg-gray-50">
        <div className="container-modern">
          <div className="text-right mb-12">
            <div className="inline-flex items-center bg-blue-100 text-blue-800 rounded-full px-4 py-2 mb-4">
              <TrendingUp className="w-4 h-4 ml-2" />
              <span className="text-sm font-medium">المحتوى المميز</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">المقالات المميزة</h2> {/* Updated heading style */}
            <p className="text-lg text-gray-600 max-w-2xl ml-auto"> {/* Updated paragraph style */}
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
              <p className="text-lg text-gray-600 max-w-2xl ml-auto">
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
                  className="group relative overflow-hidden rounded-3xl h-48 w-80 flex-shrink-0 snap-center transition-all duration-300 hover:shadow-2xl hover:border-blue-300 cursor-pointer bg-white border border-gray-100"
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
                        تصفح جميع المقالات
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