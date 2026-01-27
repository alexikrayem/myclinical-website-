import React from 'react';
import Skeleton from '../ui/Skeleton';

const CourseCardSkeleton: React.FC = () => {
    return (
        <div className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col h-full">
            {/* Thumbnail */}
            <div className="relative aspect-video w-full overflow-hidden">
                <Skeleton className="w-full h-full" />
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col flex-grow">
                {/* Title */}
                <Skeleton className="w-3/4 h-7 mb-2" />

                {/* Description */}
                <Skeleton className="w-full h-4 mb-2" />
                <Skeleton className="w-2/3 h-4 mb-4" />

                {/* Meta Info */}
                <div className="flex items-center gap-4 mb-4 mt-auto">
                    <div className="flex items-center gap-1">
                        <Skeleton className="w-4 h-4 rounded-full" />
                        <Skeleton className="w-12 h-3" />
                    </div>
                    <div className="flex items-center gap-1">
                        <Skeleton className="w-4 h-4 rounded-full" />
                        <Skeleton className="w-12 h-3" />
                    </div>
                </div>

                {/* Footer/Button */}
                <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                    <Skeleton className="w-20 h-6" />
                    <Skeleton className="w-24 h-10 rounded-xl" />
                </div>
            </div>
        </div>
    );
};

interface ListSkeletonProps {
    count?: number;
}

export const CourseListSkeleton: React.FC<ListSkeletonProps> = ({ count = 6 }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: count }).map((_, i) => (
                <CourseCardSkeleton key={i} />
            ))}
        </div>
    );
};

export default CourseListSkeleton;
