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
    emptyMessage?: string;
}

const CourseList: React.FC<CourseListProps> = ({
    courses,
    emptyMessage = "لا توجد دورات متاحة حالياً."
}) => {
    // Loading handled by parent component using CourseListSkeleton

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
