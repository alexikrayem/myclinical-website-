import React from 'react';
import { Video, Award, Star, Users, Sparkles, CheckCircle2 } from 'lucide-react';

const RotatingDentalImages: React.FC = () => {
    return (
        <div className="relative w-full h-full p-4 perspective-1000">
            {/* Abstract Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-100/50 to-purple-100/50 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>

            <div className="grid grid-cols-2 grid-rows-6 gap-4 h-full w-full">

                {/* Item 1: Main Image (Large, Top Left) - Spans 2 cols, 3 rows */}
                <div className="col-span-2 row-span-3 relative group rounded-[32px] overflow-hidden shadow-lg border border-white/60 bg-white">
                    <img
                        src="https://images.pexels.com/photos/3845729/pexels-photo-3845729.jpeg?auto=compress&cs=tinysrgb&w=800"
                        alt="Dental Surgery"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80"></div>
                    <div className="absolute bottom-0 right-0 p-6 text-right">
                        <div className="inline-flex items-center gap-1.5 bg-blue-600/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold mb-2 shadow-lg">
                            <Sparkles size={12} />
                            <span>الأكثر قراءة</span>
                        </div>
                        <h3 className="text-white font-bold text-xl mb-1">جراحة الوجه والفكين</h3>
                        <p className="text-blue-100 text-sm">أحدث التقنيات الجراحية لعام 2025</p>
                    </div>
                </div>

                {/* Item 2: Stat Card (Middle Left) */}
                <div className="col-span-1 row-span-2 bg-white/90 backdrop-blur-xl rounded-[32px] p-5 shadow-lg border border-white flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300">
                    <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <Users size={20} />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-gray-900 mb-1">+10k</p>
                        <p className="text-xs font-medium text-gray-500">طبيب مشترك يثق بنا</p>
                    </div>
                </div>

                {/* Item 3: Image Card (Middle Right) */}
                <div className="col-span-1 row-span-2 relative group rounded-[32px] overflow-hidden shadow-lg border border-white/60 bg-white">
                    <img
                        src="https://images.pexels.com/photos/3779702/pexels-photo-3779702.jpeg?auto=compress&cs=tinysrgb&w=800"
                        alt="Cosmetic"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md rounded-full px-2.5 py-1 text-[10px] font-bold text-gray-800 shadow-sm flex items-center gap-1">
                        <Star size={10} className="text-yellow-500 fill-yellow-500" />
                        <span>تجميل</span>
                    </div>
                </div>

                {/* Item 4: Feature Card (Bottom Left) */}
                <div className="col-span-1 row-span-1 bg-gradient-to-br from-blue-600 to-blue-700 rounded-[32px] p-4 shadow-lg text-white flex items-center gap-3 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                        <Award size={20} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold">شهادات معتمدة</p>
                    </div>
                </div>

                {/* Item 5: Video Preview (Bottom Right) */}
                <div className="col-span-1 row-span-1 bg-gray-900 rounded-[32px] overflow-hidden relative group border border-gray-800">
                    <img
                        src="https://images.pexels.com/photos/3845625/pexels-photo-3845625.jpeg?auto=compress&cs=tinysrgb&w=800"
                        alt="Implants"
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-300"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform cursor-pointer">
                            <Video size={18} className="text-gray-900 ml-0.5" />
                        </div>
                    </div>
                </div>

            </div>

            {/* Floating Elements / "Hovering Cards" */}
            <div className="absolute -left-6 top-[20%] bg-white/95 backdrop-blur-sm p-3 rounded-2xl shadow-xl border border-white/50 animate-float-slow z-20 flex items-center gap-3 max-w-[200px] hover:scale-105 transition-transform cursor-pointer">
                <div className="bg-red-100 p-2.5 rounded-full flex-shrink-0 relative">
                    <Video className="w-5 h-5 text-red-600" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-red-500 mb-0.5">دورة جديدة</p>
                    <p className="text-xs font-bold text-gray-900 leading-tight">تقويم الأسنان الشفاف</p>
                </div>
            </div>

        </div>
    );
};

export default RotatingDentalImages;
