import React, { useState } from 'react';
import { Settings2, X, Check, Sparkles } from 'lucide-react';
import { useTags } from '../../hooks/useArticles';

interface SpecialtySelectorProps {
    selectedSpecialties: string[];
    onSave: (specialties: string[]) => void;
}

const MAX_SPECIALTIES = 3;

const SpecialtySelector: React.FC<SpecialtySelectorProps> = ({ selectedSpecialties, onSave }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempSelected, setTempSelected] = useState<string[]>(selectedSpecialties);
    const { data: tags = [] } = useTags();

    const openModal = () => {
        setTempSelected(selectedSpecialties);
        setIsOpen(true);
    };

    const toggleTag = (tag: string) => {
        setTempSelected(prev => {
            if (prev.includes(tag)) return prev.filter(t => t !== tag);
            if (prev.length >= MAX_SPECIALTIES) return prev;
            return [...prev, tag];
        });
    };

    const handleConfirm = () => {
        onSave(tempSelected);
        setIsOpen(false);
    };

    const handleClear = () => {
        onSave([]);
        setIsOpen(false);
    };

    return (
        <>
            {/* Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-l from-blue-50 via-indigo-50 to-purple-50 border border-blue-100/60 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 text-right">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                        <Sparkles size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-sm">تخصيص المحتوى</h3>
                        <p className="text-xs text-gray-500">
                            {selectedSpecialties.length > 0
                                ? `تم اختيار ${selectedSpecialties.length} تخصصات`
                                : 'اختر تخصصاتك لعرض المحتوى الأنسب لك'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {selectedSpecialties.map(s => (
                        <span key={s} className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                            {s}
                        </span>
                    ))}
                    <button
                        onClick={openModal}
                        className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm"
                    >
                        <Settings2 size={16} />
                        {selectedSpecialties.length > 0 ? 'تعديل' : 'اختر تخصصاتك'}
                    </button>
                </div>
            </div>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

                    {/* Dialog */}
                    <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-scaleIn">
                        {/* Close */}
                        <button onClick={() => setIsOpen(false)} className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                            <X size={20} />
                        </button>

                        <div className="text-right mb-6">
                            <h2 className="text-2xl font-black text-gray-900 mb-2">اختر تخصصاتك</h2>
                            <p className="text-gray-500 text-sm">
                                حدد حتى {MAX_SPECIALTIES} تخصصات لعرض المحتوى الأنسب لك أولاً
                            </p>
                        </div>

                        {/* Counter */}
                        <div className="flex items-center justify-between mb-4 px-1">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tempSelected.length >= MAX_SPECIALTIES
                                    ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                {tempSelected.length} / {MAX_SPECIALTIES}
                            </span>
                            {tempSelected.length > 0 && (
                                <button onClick={() => setTempSelected([])} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                                    مسح الكل
                                </button>
                            )}
                        </div>

                        {/* Tag Pills */}
                        <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pb-4 mb-6">
                            {tags.map((tag: string) => {
                                const isSelected = tempSelected.includes(tag);
                                const isDisabled = !isSelected && tempSelected.length >= MAX_SPECIALTIES;
                                return (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        disabled={isDisabled}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border ${isSelected
                                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-transparent shadow-md scale-105'
                                                : isDisabled
                                                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 shadow-sm'
                                            }`}
                                    >
                                        {isSelected && <Check size={14} className="inline ml-1" />}
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleConfirm}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                            >
                                تأكيد الاختيار
                            </button>
                            <button
                                onClick={handleClear}
                                className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                            >
                                عرض الكل
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SpecialtySelector;
