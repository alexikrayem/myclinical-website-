import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry for client-side error monitoring
 * Call this early in your app initialization
 */
export const initSentry = (): void => {
    const dsn = import.meta.env.VITE_SENTRY_DSN;

    if (!dsn) {
        console.warn('⚠️ VITE_SENTRY_DSN not configured. Error monitoring disabled.');
        return;
    }

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false,
            }),
        ],
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
    });

    console.log('✅ Sentry client error monitoring initialized');
};

/**
 * Capture an exception manually
 */
export const captureException = (error: Error, context?: Record<string, any>): void => {
    Sentry.captureException(error, { extra: context });
};

/**
 * Capture a message manually
 */
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info'): void => {
    Sentry.captureMessage(message, level);
};

/**
 * Set user context for Sentry
 */
export const setUser = (user: { id: string; phone?: string; name?: string } | null): void => {
    Sentry.setUser(user);
};

export default Sentry;
