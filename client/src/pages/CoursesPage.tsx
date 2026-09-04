import { useEffect, useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { coursesApi } from '../lib/api';
import CourseList from '../components/courses/CourseList';
import VideoCourseCard from '../components/courses/CourseCard';
import CourseListSkeleton from '../components/loaders/CourseListSkeleton';

export interface Course {
    id: string;
    title: string;
    description: string;
    cover_image: string;
    publication_date: string;
    author: string;
    categories: string[];
    credits_required: number;
    billing_model?: "free" | "per_course" | "per_minute";
    minute_cost?: number;
    duration: number;
    is_featured?: boolean;
}

const CoursesPage = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('');

    // Fetch categories once on mount from the backend
    useEffect(() => {
        coursesApi.getCategories()
            .then(setCategories)
            .catch(() => setCategories([]));
    }, []);

    // Featured courses do not depend on the list filters, so avoid fetching
    // them again for every search term or category selection.
    useEffect(() => {
        coursesApi.getFeatured()
            .then(setFeaturedCourses)
            .catch(() => setFeaturedCourses([]));
    }, []);

    useEffect(() => {
        const fetchCourses = async () => {
            setIsLoading(true);
            try {
                const allCoursesData = await coursesApi.getAll({ search: searchQuery, category: activeCategory });

                setCourses(allCoursesData.data);
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
                        {featuredCourses.slice(0, 2).map((course: Course) => (
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
                            data-testid="courses-search-input"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                        <button
                            onClick={() => setActiveCategory('')}
                            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${activeCategory === ''
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                }`}
                            data-testid="courses-category-all"
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
                                data-testid={`courses-category-${encodeURIComponent(cat)}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {isLoading ? (
                <CourseListSkeleton count={6} />
            ) : (
                <CourseList courses={courses} />
            )}

        </div>
    );
};

export default CoursesPage;
