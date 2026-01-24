import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    User, Phone, Edit2, Check, X, CreditCard, History,
    Coins, Video, FileText, Lock, LogOut, ChevronLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { creditsApi, authApi } from '../lib/api';
import CreditRedeemModal from '../components/credits/CreditRedeemModal';
import toast from 'react-hot-toast';

const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, credits, isAuthenticated, isLoading, logout, refreshCredits, updateProfile } = useAuth();

    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showRedeemModal, setShowRedeemModal] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate('/login', { state: { from: { pathname: '/profile' } } });
        }
    }, [isAuthenticated, isLoading, navigate]);

    useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || '');
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'history' && isAuthenticated) {
            fetchTransactions();
        }
    }, [activeTab, isAuthenticated]);

    const fetchTransactions = async () => {
        setIsLoadingTransactions(true);
        try {
            const data = await creditsApi.getTransactions(1, 20);
            setTransactions(data.data || []);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setIsLoadingTransactions(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            await updateProfile(displayName);
            toast.success('تم تحديث الملف الشخصي');
            setIsEditing(false);
        } catch (error: any) {
            toast.error(error.message || 'فشل التحديث');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmNewPassword) {
            toast.error('كلمتا المرور غير متطابقتين');
            return;
        }

        if (newPassword.length < 8) {
            toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
            return;
        }

        setIsChangingPassword(true);
        try {
            await authApi.changePassword(currentPassword, newPassword);
            toast.success('تم تغيير كلمة المرور بنجاح');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'فشل تغيير كلمة المرور');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'redeem': return <CreditCard className="text-green-500" size={18} />;
            case 'usage': return <Video className="text-blue-500" size={18} />;
            default: return <Coins className="text-gray-500" size={18} />;
        }
    };

    const getTransactionLabel = (type: string) => {
        switch (type) {
            case 'redeem': return 'شحن رصيد';
            case 'usage': return 'استهلاك';
            case 'bonus': return 'مكافأة';
            default: return type;
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="container mx-auto px-4 py-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                                <User size={32} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">{user?.display_name || 'مستخدم'}</h1>
                                <p className="text-white/80" dir="ltr">{user?.phone_number}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                        >
                            <LogOut size={18} />
                            <span className="hidden sm:inline">خروج</span>
                        </button>
                    </div>

                    {/* Credits Summary */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                            <Coins size={24} className="mx-auto mb-2 text-yellow-300" />
                            <div className="text-2xl font-bold">{credits?.balance || 0}</div>
                            <div className="text-sm text-white/70">رصيد عام</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                            <Video size={24} className="mx-auto mb-2 text-blue-300" />
                            <div className="text-2xl font-bold">{credits?.video_watch_minutes || 0}</div>
                            <div className="text-sm text-white/70">دقيقة مشاهدة</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                            <FileText size={24} className="mx-auto mb-2 text-green-300" />
                            <div className="text-2xl font-bold">{credits?.article_credits || 0}</div>
                            <div className="text-sm text-white/70">مقالات</div>
                        </div>
                    </div>

                    {/* Redeem Button */}
                    <button
                        onClick={() => setShowRedeemModal(true)}
                        className="w-full mt-4 py-3 bg-white text-blue-600 font-medium rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <CreditCard size={20} />
                        شحن رصيد بكود
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="container mx-auto px-4 -mt-4">
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="flex border-b border-gray-100">
                        {[
                            { id: 'profile', label: 'الملف الشخصي', icon: User },
                            { id: 'security', label: 'الأمان', icon: Lock },
                            { id: 'history', label: 'السجل', icon: History },
                        ].map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={`flex-1 py-4 px-4 flex items-center justify-center gap-2 font-medium transition-colors ${activeTab === id
                                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Icon size={18} />
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-gray-900">معلومات الحساب</h2>
                                    {!isEditing && (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                        >
                                            <Edit2 size={16} />
                                            تعديل
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-500 mb-1">الاسم</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                            />
                                        ) : (
                                            <p className="text-gray-900">{user?.display_name || 'غير محدد'}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-500 mb-1">رقم الهاتف</label>
                                        <p className="text-gray-900 flex items-center gap-2" dir="ltr">
                                            <Phone size={16} className="text-gray-400" />
                                            {user?.phone_number}
                                        </p>
                                    </div>
                                </div>

                                {isEditing && (
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={isSaving}
                                            className="flex-1 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2"
                                        >
                                            {isSaving ? (
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Check size={18} />
                                                    حفظ
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                setDisplayName(user?.display_name || '');
                                            }}
                                            className="px-6 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2"
                                        >
                                            <X size={18} />
                                            إلغاء
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-bold text-gray-900">تغيير كلمة المرور</h2>

                                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            كلمة المرور الحالية
                                        </label>
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            كلمة المرور الجديدة
                                        </label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                            required
                                            minLength={8}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            تأكيد كلمة المرور الجديدة
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmNewPassword}
                                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isChangingPassword}
                                        className="w-full py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2"
                                    >
                                        {isChangingPassword ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            'تغيير كلمة المرور'
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-gray-900">سجل المعاملات</h2>

                                {isLoadingTransactions ? (
                                    <div className="flex justify-center py-8">
                                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : transactions.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        لا توجد معاملات بعد
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {transactions.map((tx) => (
                                            <div
                                                key={tx.id}
                                                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {getTransactionIcon(tx.transaction_type)}
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {tx.description || getTransactionLabel(tx.transaction_type)}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {new Date(tx.transaction_date).toLocaleDateString('ar-SA')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Redeem Modal */}
            <CreditRedeemModal
                isOpen={showRedeemModal}
                onClose={() => {
                    setShowRedeemModal(false);
                    refreshCredits();
                }}
            />
        </div>
    );
};

export default ProfilePage;
