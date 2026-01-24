import React, { useEffect } from 'react';
import { Users, Award, BookOpen, Heart } from 'lucide-react';

const AboutPage: React.FC = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 pt-24 pb-12">
            <div className="container-modern">
                {/* Header Section */}
                <div className="text-center mb-16 animate-fadeIn">
                    <div className="inline-flex items-center justify-center p-3 bg-blue-100 text-blue-600 rounded-2xl mb-6 shadow-sm">
                        <Users size={32} />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
                        من نحن
                    </h1>
                    <div className="w-24 h-1.5 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full mb-8"></div>
                </div>

                {/* Main Content Card */}
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 animate-slideDown">
                        <div className="relative h-64 bg-gradient-to-r from-blue-600 to-purple-600 overflow-hidden">
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=2068')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                            <div className="absolute bottom-0 right-0 p-8 text-white">
                                <h2 className="text-2xl font-bold mb-2">رؤيتنا ورسالتنا</h2>
                                <p className="text-blue-100">نحو مجتمع طبي متكامل ومتميز</p>
                            </div>
                        </div>

                        <div className="p-8 md:p-12">
                            <div className="prose prose-lg max-w-none text-gray-600 leading-relaxed">
                                <p className="text-xl font-medium text-gray-800 mb-8">
                                    نحن مجموعة من أطباء الأسنان قمنا بإنشاء هذا الموقع للممارسين والباحثين في طب الأسنان لتبادل المعرفة والخبرات، والارتقاء بمستوى طب الأسنان في العالم العربي.
                                </p>

                                <div className="grid md:grid-cols-2 gap-8 mt-12">
                                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="bg-blue-500 text-white p-2 rounded-lg">
                                                <BookOpen size={20} />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 m-0">نشر المعرفة</h3>
                                        </div>
                                        <p className="text-sm m-0">
                                            توفير منصة موثوقة لنشر المقالات العلمية والأبحاث الحديثة باللغة العربية.
                                        </p>
                                    </div>

                                    <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="bg-purple-500 text-white p-2 rounded-lg">
                                                <Award size={20} />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 m-0">التميز المهني</h3>
                                        </div>
                                        <p className="text-sm m-0">
                                            دعم التطوير المهني المستمر للأطباء من خلال مشاركة أفضل الممارسات السريرية.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-12 p-6 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                                    <Heart className="w-8 h-8 text-red-500 mx-auto mb-4 animate-pulse" />
                                    <p className="text-gray-700 font-medium m-0">
                                        نسعى جاهدين لتقديم محتوى عالي الجودة يساهم في إثراء المحتوى الطبي العربي.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutPage;
