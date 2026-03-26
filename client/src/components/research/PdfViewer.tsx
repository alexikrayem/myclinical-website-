import React, { useEffect, useState } from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { Loader, AlertTriangle, Lock, Unlock } from 'lucide-react';
import api, { creditsApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface PdfViewerProps {
    researchId: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ researchId }) => {
    const { user } = useAuth();
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needsUnlock, setNeedsUnlock] = useState(false);
    const [unlocking, setUnlocking] = useState(false);

    // Create new plugin instance
    const defaultLayoutPluginInstance = defaultLayoutPlugin({
        sidebarTabs: () => [], // Hide sidebar
        renderToolbar: (Toolbar) => (
            <Toolbar>
                {(slots) => {
                    const {
                        CurrentPageInput,
                        EnterFullScreen,
                        GoToNextPage,
                        GoToPreviousPage,
                        NumberOfPages,
                        ShowSearchPopover,
                        Zoom,
                        ZoomIn,
                        ZoomOut,
                    } = slots;
                    return (
                        <div
                            style={{
                                alignItems: 'center',
                                display: 'flex',
                                width: '100%',
                            }}
                        >
                            <div style={{ padding: '0px 2px' }}>
                                <ShowSearchPopover />
                            </div>
                            <div style={{ padding: '0px 2px' }}>
                                <ZoomOut />
                            </div>
                            <div style={{ padding: '0px 2px' }}>
                                <Zoom />
                            </div>
                            <div style={{ padding: '0px 2px' }}>
                                <ZoomIn />
                            </div>
                            <div style={{ padding: '0px 2px', marginLeft: 'auto' }}>
                                <GoToPreviousPage />
                            </div>
                            <div style={{ padding: '0px 2px', width: '4rem' }}>
                                <CurrentPageInput />
                            </div>
                            <div style={{ padding: '0px 2px' }}>
                                / <NumberOfPages />
                            </div>
                            <div style={{ padding: '0px 2px' }}>
                                <GoToNextPage />
                            </div>
                            <div style={{ padding: '0px 2px', marginLeft: 'auto' }}>
                                <EnterFullScreen />
                            </div>
                        </div>
                    );
                }}
            </Toolbar>
        ),
    });

    useEffect(() => {
        const fetchPdfUrl = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const token = localStorage.getItem('user_token');
                // Fetch secure signed URL from our backend
                // The backend handles checking auth and generating a short-lived signed URL
                const response = await api.get(`/research/${researchId}/pdf`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });

                if (response.data.url) {
                    setPdfUrl(response.data.url);
                } else {
                    setError('لم يتم العثور على ملف PDF');
                }
            } catch (err: unknown) {
                const errorResponse = err as { response?: { status?: number } };
                console.error('Error fetching PDF URL:', err);
                if (errorResponse.response?.status === 401) {
                    setError('عذراً، يجب تسجيل الدخول لعرض هذا البحث');
                } else if (errorResponse.response?.status === 403) {
                    setNeedsUnlock(true);
                } else if (errorResponse.response?.status === 404) {
                    setError('ملف البحث غير متوفر حالياً');
                } else {
                    setError('حدث خطأ أثناء تحميل ملف البحث');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchPdfUrl();
    }, [researchId, user]);

    const handleUnlock = async () => {
        try {
            setUnlocking(true);
            setError(null);
            await creditsApi.consumeResearch(researchId);
            setNeedsUnlock(false);

            // Re-fetch the PDF now that we've unlocked it
            setLoading(true);
            const token = localStorage.getItem('user_token');
            const response = await api.get(`/research/${researchId}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.url) {
                setPdfUrl(response.data.url);
            }
        } catch (err: unknown) {
            const errorResponse = err as { response?: { data?: { error?: string } } };
            setError(errorResponse.response?.data?.error || 'فشل في فتح البحث. تأكد من وجود رصيد كافي.');
        } finally {
            setUnlocking(false);
            setLoading(false);
        }
    };

    // Disable right click to prevent easy saving
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    if (!user) {
        return (
            <div
                className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-2xl border border-gray-200"
                data-testid="research-pdf-login-required"
            >
                <Lock className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">تسجيل الدخول مطلوب</h3>
                <p className="text-gray-600 text-center mb-6">
                    يجب عليك تسجيل الدخول لعرض الأوراق البحثية الكاملة
                </p>
                <a href="/login" className="btn-primary">
                    تسجيل الدخول
                </a>
            </div>
        );
    }

    if (loading) {
        return (
            <div
                className="flex justify-center items-center h-96 bg-gray-50 rounded-2xl border border-gray-200"
                data-testid="research-pdf-loading"
            >
                <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="mr-3 text-gray-600 font-medium">جاري تحميل البحث...</span>
            </div>
        );
    }

    if (needsUnlock) {
        return (
            <div
                className="flex flex-col items-center justify-center p-12 bg-blue-50 rounded-2xl border border-blue-100 h-96"
                data-testid="research-pdf-locked"
            >
                <Lock className="w-12 h-12 text-blue-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">محتوى مدفوع</h3>
                <p className="text-gray-600 text-center mb-6">
                    هذا البحث يتطلب استخدام رصيد لفتحه (1 رصيد بحث أو 1 من الرصيد العام)
                </p>
                <button
                    onClick={handleUnlock}
                    disabled={unlocking}
                    className="btn-primary flex items-center"
                >
                    {unlocking ? (
                        <><Loader className="w-5 h-5 ml-2 animate-spin" /> جاري الفتح...</>
                    ) : (
                        <><Unlock className="w-5 h-5 ml-2" /> فتح البحث الان</>
                    )}
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-2xl border border-red-100"
                data-testid="research-pdf-error"
            >
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-lg font-bold text-red-700 mb-2">تعذر تحميل الملف</h3>
                <p className="text-red-600 text-center">{error}</p>
            </div>
        );
    }

    return (
        <div
            className="h-[800px] w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative"
            onContextMenu={handleContextMenu}
            data-testid="research-pdf-container"
        >
            {/* Watermark overlay */}
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-5 overflow-hidden select-none">
                <div className="transform -rotate-45 text-4xl font-bold text-gray-900 whitespace-nowrap">
                    {Array(20).fill(`${user.display_name || user.phone_number} `).map((text, i) => (
                        <div key={i} className="mb-20">{text.repeat(10)}</div>
                    ))}
                </div>
            </div>

            {pdfUrl && (
                <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                    <div
                        style={{ height: '100%', direction: 'ltr' }}
                        className="pdf-viewer-container"
                    >
                        <Viewer
                            fileUrl={pdfUrl}
                            plugins={[defaultLayoutPluginInstance]}
                            defaultScale={1}
                            theme={{
                                theme: 'auto',
                            }}
                        />
                    </div>
                </Worker>
            )}
        </div>
    );
};

export default PdfViewer;
