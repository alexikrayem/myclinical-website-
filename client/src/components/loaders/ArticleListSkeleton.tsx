import React from 'react';
import Skeleton from '../ui/Skeleton';

const ArticleCardSkeleton: React.FC = () => {
    return (
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col h-full card-hover">
            {/* Image Skeleton */}
            <div className="h-48 w-full relative overflow-hidden">
                <Skeleton className="w-full h-full" type="rect" />
                <div className="absolute top-4 right-4">
                    <Skeleton className="w-20 h-6 rounded-full" />
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Skeleton className="w-4 h-4 rounded-full" />
                        <Skeleton className="w-24 h-4" />
                    </div>
                    <Skeleton className="w-16 h-4" />
                </div>

                <Skeleton className="w-3/4 h-8 mb-3" />
                <Skeleton className="w-full h-4 mb-2" />
                <Skeleton className="w-2/3 h-4 mb-4" />

                <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-gray-50">
                    <Skeleton className="w-12 h-6 rounded-full" />
                    <Skeleton className="w-16 h-6 rounded-full" />
                </div>
            </div>
        </div>
    );
};

interface ListSkeletonProps {
    count?: number;
}

export const ArticleListSkeleton: React.FC<ListSkeletonProps> = ({ count = 6 }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: count }).map((_, i) => (
                <ArticleCardSkeleton key={i} />
            ))}
        </div>
    );
};

export default ArticleListSkeleton;
