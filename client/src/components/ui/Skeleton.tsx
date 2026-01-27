import React from 'react';

interface SkeletonProps {
    className?: string; // Allow custom classes for width, height, margin
    type?: 'text' | 'rect' | 'circle'; // Preset shapes
    count?: number; // Repeat generic skeletons
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '', type = 'text', count = 1 }) => {
    const baseClasses = "animate-pulse bg-gray-200/80 rounded";

    const getPresetClasses = () => {
        switch (type) {
            case 'circle': return 'rounded-full';
            case 'rect': return 'rounded-xl';
            default: return 'rounded';
        }
    };

    const items = Array.from({ length: count });

    return (
        <>
            {items.map((_, index) => (
                <div
                    key={index}
                    className={`${baseClasses} ${getPresetClasses()} ${className}`}
                />
            ))}
        </>
    );
};

export default Skeleton;
