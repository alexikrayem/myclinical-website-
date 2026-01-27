import React, { useState } from 'react';
import { Share2, Twitter, Facebook, Linkedin, Link2, Check, X } from 'lucide-react';

interface ShareButtonsProps {
    url: string;
    title: string;
    description?: string;
}

const ShareButtons: React.FC<ShareButtonsProps> = ({ url, title, description }) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [copied, setCopied] = useState(false);

    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);

    const shareLinks = {
        twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text: description,
                    url,
                });
            } catch (err) {
                // User cancelled or error
            }
        } else {
            setShowDropdown(!showDropdown);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleNativeShare}
                className="btn-secondary inline-flex items-center"
            >
                <Share2 size={18} className="ml-2" />
                مشاركة
            </button>

            {showDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-50 min-w-[200px] animate-fadeIn">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                        <span className="text-sm font-medium text-gray-700">مشاركة المقال</span>
                        <button
                            onClick={() => setShowDropdown(false)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-3">
                        <a
                            href={shareLinks.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-10 h-10 bg-[#1DA1F2] text-white rounded-lg hover:opacity-90 transition-opacity"
                            title="Twitter"
                        >
                            <Twitter size={18} />
                        </a>
                        <a
                            href={shareLinks.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-10 h-10 bg-[#1877F2] text-white rounded-lg hover:opacity-90 transition-opacity"
                            title="Facebook"
                        >
                            <Facebook size={18} />
                        </a>
                        <a
                            href={shareLinks.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-10 h-10 bg-[#0A66C2] text-white rounded-lg hover:opacity-90 transition-opacity"
                            title="LinkedIn"
                        >
                            <Linkedin size={18} />
                        </a>
                        <a
                            href={shareLinks.whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-10 h-10 bg-[#25D366] text-white rounded-lg hover:opacity-90 transition-opacity"
                            title="WhatsApp"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                        </a>
                    </div>

                    <button
                        onClick={handleCopyLink}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                    >
                        {copied ? (
                            <>
                                <Check size={16} className="text-green-600" />
                                <span className="text-green-600">تم النسخ!</span>
                            </>
                        ) : (
                            <>
                                <Link2 size={16} />
                                <span>نسخ الرابط</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ShareButtons;
