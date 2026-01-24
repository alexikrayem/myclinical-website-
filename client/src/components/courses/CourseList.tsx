import React from 'react';
import VideoCourseCard from './CourseCard';
import { Loader2 } from 'lucide-react';

interface Course {
    id: string;
    title: string;
    description: string;
    cover_image: string;
    publication_date: string;
    author: string;
    categories: string[];
    credits_required: number;
    duration: number;
    is_featured?: boolean;
}

interface CourseListProps {
    courses: Course[];
    isLoading: boolean;
    emptyMessage?: string;
}

const CourseList: React.FC<CourseListProps> = ({
    courses,
    isLoading,
    emptyMessage = "لا توجد دورات متاحة حالياً."
}) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl overflow-hidden card-shadow h-[450px] animate-pulse">
                        <div className="h-56 bg-gray-200"></div>
                        <div className="p-6 space-y-4">
                            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                                <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 ml-3"></div>
                                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (courses.length === 0) {
        return (
            <div className="text-center py-16 bg-white rounded-3xl card-shadow">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="text-gray-400 animate-spin-slow" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">عذراً</h3>
                <p className="text-gray-500">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course) => (
                <VideoCourseCard key={course.id} course={course} />
            ))}
        </div>
    );
};

export default CourseList;
