import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, CreditCard, LogOut, ChevronDown, Coins, Video, FileText } from 'lucide-react';

interface UserMenuProps {
    onRedeemClick?: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onRedeemClick }) => {
    const { user, credits, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        setIsOpen(false);
    };

    if (!isAuthenticated) {
        return (
            <div className="flex items-center gap-2">
                <Link
                    to="/login"
                    className="px-4 py-2 text-gray-700 hover:text-blue-600 font-medium transition-colors"
                >
                    دخول
                </Link>
                <Link
                    to="/register"
                    className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 font-medium transition-colors"
                >
                    حساب جديد
                </Link>
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                    <User size={16} className="text-white" />
                </div>
                <span className="font-medium text-gray-700 hidden sm:inline">
                    {user?.display_name || 'المستخدم'}
                </span>
                <ChevronDown size={16} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fadeIn">
                        {/* User Info */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <div className="font-medium text-gray-900">
                                {user?.display_name || 'مستخدم'}
                            </div>
                            <div className="text-sm text-gray-500 mt-1" dir="ltr">
                                {user?.phone_number}
                            </div>
                        </div>

                        {/* Credits Summary */}
                        <div className="p-4 border-b border-gray-100">
                            <div className="text-sm font-medium text-gray-500 mb-3">رصيدك</div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-2 bg-yellow-50 rounded-xl">
                                    <Coins size={18} className="mx-auto text-yellow-600 mb-1" />
                                    <div className="text-lg font-bold text-gray-900">{credits?.balance || 0}</div>
                                    <div className="text-xs text-gray-500">عام</div>
                                </div>
                                <div className="text-center p-2 bg-blue-50 rounded-xl">
                                    <Video size={18} className="mx-auto text-blue-600 mb-1" />
                                    <div className="text-lg font-bold text-gray-900">{credits?.video_watch_minutes || 0}</div>
                                    <div className="text-xs text-gray-500">دقيقة</div>
                                </div>
                                <div className="text-center p-2 bg-green-50 rounded-xl">
                                    <FileText size={18} className="mx-auto text-green-600 mb-1" />
                                    <div className="text-lg font-bold text-gray-900">{credits?.article_credits || 0}</div>
                                    <div className="text-xs text-gray-500">مقال</div>
                                </div>
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="p-2">
                            <Link
                                to="/profile"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors"
                            >
                                <User size={18} className="text-gray-400" />
                                <span className="text-gray-700">الملف الشخصي</span>
                            </Link>

                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    if (onRedeemClick) onRedeemClick();
                                    else navigate('/profile?tab=redeem');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors"
                            >
                                <CreditCard size={18} className="text-gray-400" />
                                <span className="text-gray-700">شحن رصيد</span>
                            </button>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 rounded-xl transition-colors text-red-600"
                            >
                                <LogOut size={18} />
                                <span>تسجيل الخروج</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default UserMenu;
