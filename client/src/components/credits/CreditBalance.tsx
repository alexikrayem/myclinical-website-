import React, { useState, useRef, useEffect } from 'react';
import { Coins, Plus, Video, FileText, BookOpen, ChevronDown, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CreditRedeemModal from './CreditRedeemModal';

// M3 fix: removed the duplicate inline RedeemCodeModal — now uses the shared
// CreditRedeemModal component so both code paths stay in sync.

const CreditBalance = () => {
    const { credits, refreshCredits, isAuthenticated } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    // Don't show if not logged in or credits are not loaded yet
    if (!isAuthenticated || !credits) return null;

    const handleRedeemSuccess = () => {
        refreshCredits();
        setIsModalOpen(false);
    };

    return (
        <div className="relative z-50 flex items-center" ref={dropdownRef}>
            {/* Main Pill */}
            <div
                className="flex items-center gap-2 bg-yellow-50 text-yellow-800 px-3 py-1.5 rounded-full border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
                <Coins size={16} className="text-yellow-600" />
                <span className="font-bold mx-1">{credits.balance}</span>
                <ChevronDown size={14} className={`text-yellow-600 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsModalOpen(true);
                    }}
                    className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full hover:bg-yellow-600 transition-colors flex items-center gap-1 mr-1"
                    title="شحن رصيد"
                >
                    <Plus size={12} />
                    شحن
                </button>
            </div>

            {/* Dropdown breakdown */}
            {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-In">
                    <div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-700">
                        تفاصيل الرصيد
                    </div>
                    <div className="p-2 space-y-1">
                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-2 text-gray-700">
                                <div className="p-1.5 bg-yellow-100 rounded-lg text-yellow-600"><Coins size={14} /></div>
                                <span className="text-sm">رصيد عام</span>
                            </div>
                            <span className="font-bold text-gray-900">{credits.balance}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-2 text-gray-700">
                                <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600"><Video size={14} /></div>
                                <span className="text-sm">دقائق مشاهدة</span>
                            </div>
                            <span className="font-bold text-gray-900">{credits.video_watch_minutes}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-2 text-gray-700">
                                <div className="p-1.5 bg-green-100 rounded-lg text-green-600"><FileText size={14} /></div>
                                <span className="text-sm">مقالات</span>
                            </div>
                            <span className="font-bold text-gray-900">{credits.article_credits}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-2 text-gray-700">
                                <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600"><BookOpen size={14} /></div>
                                <span className="text-sm">أبحاث</span>
                            </div>
                            <span className="font-bold text-gray-900">{credits.research_credits}</span>
                        </div>

                        {/* Typed Credits */}
                        {credits.typed_credits && credits.typed_credits.length > 0 && (
                            <>
                                <div className="border-t border-gray-100 my-1 pt-1">
                                    <div className="px-2 text-xs font-semibold text-amber-600 mb-1">رصيد مخصص</div>
                                </div>
                                {credits.typed_credits.map((tc) => (
                                    <div key={tc.credit_type_id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-2 text-gray-700">
                                            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600"><Tag size={14} /></div>
                                            <span className="text-sm">{tc.name}</span>
                                        </div>
                                        <span className="font-bold text-gray-900">{tc.balance}</span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* M3 fix: now uses the shared CreditRedeemModal instead of a local duplicate */}
            <CreditRedeemModal
                isOpen={isModalOpen}
                onClose={handleRedeemSuccess}
            />
        </div>
    );
};

export default CreditBalance;
