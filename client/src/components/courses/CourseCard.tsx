import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Tag, User, ArrowLeft, Play, Coins } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { ar } from 'date-fns/locale';

interface VideoCourseCardProps {
    course: {
        id: string;
        title: string;
        description: string;
        cover_image: string;
        publication_date: string;
        author: string;
        categories: string[];
        credits_required: number;
        duration: number; // in seconds
        is_featured?: boolean;
    };
    featured?: boolean;
}

const VideoCourseCard: React.FC<VideoCourseCardProps> = ({ course, featured = false }) => {
    const navigate = useNavigate();

    const formattedDate = formatDistance(
        new Date(course.publication_date),
        new Date(),
        { addSuffix: true, locale: ar }
    );

    // Convert duration from seconds to human-readable format
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours} س${minutes > 0 ? ` و ${minutes} د` : ''}`;
        }
        return `${minutes} د`;
    };

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent navigation if clicking on a link or button
        if ((e.target as HTMLElement).closest('a, button')) {
            return;
        }

        navigate(`/courses/${course.id}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (featured) {
        return (
            <div
                className="relative overflow-hidden rounded-3xl card-shadow-lg group cursor-pointer transition-modern hover:scale-[1.02]"
                onClick={handleCardClick}
            >
                <div className="relative h-[500px]">
                    <img
                        src={course.cover_image}
                        alt={course.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>

                    <div className="absolute top-6 right-6">
                        <div className="bg-blue-500/90 text-white text-sm px-3 py-1.5 rounded-full flex items-center">
                            <Play size={14} className="ml-1" />
                            فيديو
                        </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                        <h2 className="text-2xl lg:text-3xl font-bold mb-3 line-clamp-2 leading-tight">{course.title}</h2>
                        <p className="mb-4 text-blue-100 line-clamp-2 text-lg leading-relaxed">{course.description}</p>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center text-sm text-blue-200 space-x-4 space-x-reverse">
                                <div className="flex items-center">
                                    <User size={16} className="ml-1" />
                                    <span className="font-medium">{course.author}</span>
                                </div>
                                <div className="flex items-center">
                                    <Clock size={16} className="ml-1" />
                                    <span>{formatDuration(course.duration)}</span>
                                </div>
                                <div className="flex items-center">
                                    <Coins size={16} className="ml-1" />
                                    <span>{course.credits_required} رصيد</span>
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/courses/${course.id}`);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="btn-primary inline-flex items-center bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30"
                            >
                                عرض التفاصيل
                                <ArrowLeft size={18} className="mr-2" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="bg-white rounded-2xl overflow-hidden card-shadow group cursor-pointer transition-modern hover:scale-[1.02] animate-scaleIn"
            onClick={handleCardClick}
        >
            <div className="relative overflow-hidden">
                <img
                    src={course.cover_image}
                    alt={course.title}
                    className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                <div className="absolute top-4 right-4">
                    <div className="bg-blue-500/90 text-white text-xs px-2.5 py-1 rounded-full flex items-center">
                        <Play size={12} className="ml-1" />
                        فيديو
                    </div>
                </div>

                <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full flex items-center">
                    <Clock size={12} className="ml-1" />
                    {formatDuration(course.duration)}
                </div>
            </div>

            <div className="p-6">
                <div className="flex flex-wrap gap-2 mb-4">
                    {course.categories.slice(0, 2).map((category, index) => (
                        <span
                            key={index}
                            className="tag-modern inline-flex items-center"
                        >
                            <Tag size={12} className="ml-1" />
                            {category}
                        </span>
                    ))}
                    {course.categories.length > 2 && (
                        <span className="text-xs text-gray-400 px-2 py-1">
                            +{course.categories.length - 2} أخرى
                        </span>
                    )}
                </div>

                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors flex-grow">
                        {course.title}
                    </h3>
                    <div className="flex items-center bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded mr-2 whitespace-nowrap">
                        <Coins size={12} className="ml-1" />
                        {course.credits_required} رصيد
                    </div>
                </div>

                <p className="text-gray-600 mb-4 line-clamp-2 leading-relaxed text-sm">{course.description}</p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center text-sm text-gray-500">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center ml-3">
                            <User size={14} className="text-white" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-700">{course.author}</div>
                            <div className="text-xs text-gray-500">{formattedDate}</div>
                        </div>
                    </div>

                    <div className="text-blue-600 group-hover:text-blue-700 transition-colors">
                        <ArrowLeft size={20} className="transform group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoCourseCard;
