import React, { useState, useEffect } from 'react';
import { Coins, Plus, X, History } from 'lucide-react';
import { creditsApi } from '../../lib/api';
import toast from 'react-hot-toast';

const RedeemCodeModal = ({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) => {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;

        setIsLoading(true);
        try {
            const data = await creditsApi.redeemCode(code);
            if (data.success) {
                toast.success(data.message);
                onSuccess();
                onClose();
                setCode('');
            } else {
                toast.error(data.message);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'فشل شحن الرصيد');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-scaleIn relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold mb-4 flex items-center">
                    <Coins className="ml-2 text-yellow-500" />
                    شحن الرصيد
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">كود الشحن</label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="أدخل الكود هنا (مثال: GIFT-1234)"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all uppercase"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !code}
                        className="btn-primary w-full"
                    >
                        {isLoading ? 'جاري التحقق...' : 'شحن الرصيد'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const CreditBalance = () => {
    const [balance, setBalance] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchBalance = async () => {
        try {
            const data = await creditsApi.getBalance();
            setBalance(data.balance);
        } catch (error) {
            console.error('Failed to fetch balance');
        }
    };

    useEffect(() => {
        fetchBalance();
    }, []);

    if (balance === null) return null; // Don't show if not logged in or loading

    return (
        <>
            <div className="flex items-center gap-2 bg-yellow-50 text-yellow-800 px-3 py-1.5 rounded-full border border-yellow-200">
                <Coins size={16} className="text-yellow-600" />
                <span className="font-bold mx-1">{balance}</span>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full hover:bg-yellow-600 transition-colors flex items-center gap-1"
                    title="شحن رصيد"
                >
                    <Plus size={12} />
                    شحن
                </button>
            </div>

            <RedeemCodeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchBalance}
            />
        </>
    );
};

export default CreditBalance;
