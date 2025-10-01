import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileText, Sparkles, TrendingUp, Users } from 'lucide-react';
import FeaturedArticles from '../components/article/FeaturedArticles';
import ArticleList from '../components/article/ArticleList';
import { articlesApi } from '../lib/api';

const HomePage: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await articlesApi.getAll({ limit: 100 });
        const articles = response.data || response || [];

        if (articles.length > 0) {
          const allTags = articles.flatMap((article: any) => article.tags);
          const uniqueTags = [...new Set(allTags)];
          const categoriesWithImages = uniqueTags.slice(0, 6).map((tag) => ({
            id: tag,
            name: tag,
            image: `https://images.pexels.com/photos/3845810/pexels-photo-3845810.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2` // Placeholder images
          }));
          setCategories(categoriesWithImages);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
  }, []);

  return (
    <div className="layout-modern">
      {/* Hero Section */}
      <section className="relative py-12 lg:py-16 overflow-hidden min-h-[60vh] md:min-h-[70vh] flex items-center justify-center text-white">
        {/* Background Gradient */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-blue-700 via-blue-800 to-purple-900 opacity-95"></div>
        {/* Subtle Dots Pattern Overlay (if `pattern-dots` is a CSS utility) */}
        {/* Assumes 'pattern-dots' adds a background pattern; adjust z-index/opacity if needed */}
        <div className="absolute inset-0 z-0 pattern-dots opacity-20"></div>

        <div className="container-modern relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Tagline */}
            <div className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6 shadow-md transition-all duration-300 hover:scale-105">
              <Sparkles className="w-4 h-4 text-white ml-2" />
              <span className="text-white text-sm font-medium">منصة طب الأسنان الرائدة</span>
            </div>
            
            {/* Heading */}
            <h1 className="text-4xl md:text-5xl lg:text-5xl font-extrabold text-white mb-6 leading-tight drop-shadow-lg">
              منصة طب الأسنان
              <span className="block text-blue-200">العربي</span>
            </h1>
            
            {/* Description */}
            <p className="text-xl md:text-2xl lg:text-3xl text-blue-100 mb-10 leading-relaxed drop-shadow-md">
              موسوعة متكاملة من المقالات والأبحاث العلمية المتخصصة
              <br />
              في مجال طب الأسنان باللغة العربية
            </p>
            
            {/* Call to Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/articles" 
                className="inline-flex items-center justify-center text-lg px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <BookOpen size={24} className="ml-3" />
                استكشف المقالات
              </Link>
              <Link 
                to="/research-topics" 
                className="inline-flex items-center justify-center text-lg px-8 py-4 bg-white/20 border border-white/30 text-white hover:bg-white/30 backdrop-blur-md font-semibold rounded-xl shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <FileText size={24} className="ml-3" />
                تصفح الأبحاث
              </Link>
            </div>
          </div>
        </div>
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
      <section className="py-12 bg-white">
        <div className="container-modern">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">التخصصات الطبية</h2> {/* Updated heading style */}
            <p className="text-lg text-gray-600 max-w-2xl mx-auto"> {/* Updated paragraph style */}
              استكشف المقالات حسب التخصص الطبي الذي يهمك
            </p>
          </div>
          
          <div className="grid-modern">
            {categories.map((category) => (
              <Link 
                key={category.id}
                to={`/articles?tag=${encodeURIComponent(category.id)}`}
                className="group relative overflow-hidden rounded-2xl card-shadow-lg h-48 transition-modern hover:scale-105"
              >
                <img 
                  src={category.image} 
                  alt={category.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{category.name}</h3>
                  <div className="flex items-center text-white/90 group-hover:text-white transition-colors">
                    <span className="text-sm font-medium">استكشف المقالات</span>
                    <ArrowLeft size={16} className="mr-2 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
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