import React, { useEffect, useState } from 'react';
import { Search, Filter, BookOpen } from 'lucide-react';
import { coursesApi } from '../lib/api';
import CourseList from '../components/courses/CourseList';
import VideoCourseCard from '../components/courses/CourseCard';

const CoursesPage = () => {
    const [courses, setCourses] = useState([]);
    const [featuredCourses, setFeaturedCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('');

    useEffect(() => {
        const fetchCourses = async () => {
            setIsLoading(true);
            try {
                const [allCoursesData, featuredData] = await Promise.all([
                    coursesApi.getAll({ search: searchQuery, category: activeCategory }),
                    coursesApi.getFeatured()
                ]);

                setCourses(allCoursesData.data);
                setFeaturedCourses(featuredData);
            } catch (error) {
                console.error('Failed to fetch courses', error);
            } finally {
                setIsLoading(false);
            }
        };

        const debounce = setTimeout(() => {
            fetchCourses();
        }, 500);

        return () => clearTimeout(debounce);
    }, [searchQuery, activeCategory]);

    const categories = [
        "طب أسنان الأطفال",
        "تقويم الأسنان",
        "جراحة الوجه والفكين",
        "زراعة الأسنان",
        "علاج الجذور",
        "طب الأسنان التجميلي"
    ];

    return (
        <div className="container mx-auto px-4 py-8 space-y-12">
            {/* Header Section */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
                <div className="inline-flex items-center justify-center p-2 bg-blue-50 rounded-full mb-4">
                    <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full ml-2">جديد</span>
                    <span className="text-blue-700 text-sm font-medium px-2">دورات تعليمية متخصصة</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                    الدورات التعليمية <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">والمحاضرات</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                    اكتشف مجموعة واسعة من الدورات والمحاضرات في مختلف تخصصات طب الأسنان، مع نظام تقييم ذكي وشهادات معتمدة.
                </p>
            </div>

            {/* Featured Section */}
            {!searchQuery && !activeCategory && featuredCourses.length > 0 && (
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                            <BookOpen className="ml-2 text-blue-600" />
                            دورات مميزة
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {featuredCourses.slice(0, 2).map((course: any) => (
                            <VideoCourseCard key={course.id} course={course} featured={true} />
                        ))}
                    </div>
                </section>
            )}

            {/* Search and Filter */}
            <div className="sticky top-20 z-30 bg-gray-50/95 backdrop-blur-sm py-4 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="ابحث عن دورة أو محاضرة..."
                            className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                        <button
                            onClick={() => setActiveCategory('')}
                            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${activeCategory === ''
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            الكل
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${activeCategory === cat
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* All Courses Grid */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">جميع الدورات</h2>
                    <span className="text-gray-500 text-sm">{courses.length} دورة متاحة</span>
                </div>
                <CourseList courses={courses} isLoading={isLoading} />
            </section>
        </div>
    );
};

export default CoursesPage;
