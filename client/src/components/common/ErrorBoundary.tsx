import { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Report to Sentry
        Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
                    <div className="text-center p-8 max-w-md">
                        <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">
                            حدث خطأ غير متوقع
                        </h1>
                        <p className="text-gray-600 mb-6">
                            نعتذر عن هذا الخطأ. تم إبلاغ فريقنا التقني وسنعمل على إصلاحه في أقرب وقت.
                        </p>
                        <div className="space-x-4 space-x-reverse">
                            <button
                                onClick={this.handleReset}
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                            >
                                العودة للرئيسية
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                            >
                                إعادة تحميل الصفحة
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
