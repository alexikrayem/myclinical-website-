import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry for error monitoring
 * Updated for @sentry/node v10+ (Handlers API removed)
 * @param {Express} app - Express application instance
 */
export const initSentry = (app) => {
    const dsn = process.env.SENTRY_DSN;

    if (!dsn) {
        console.warn('⚠️  SENTRY_DSN not configured. Error monitoring disabled.');
        return;
    }

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        integrations: [
            Sentry.httpIntegration({ tracing: true }),
        ],
    });

    console.log('✅ Sentry error monitoring initialized');
};

/**
 * Sentry request handler middleware (v10 compatible no-op shim)
 * In v10, request context is captured automatically via httpIntegration.
 */
export const sentryRequestHandler = (req, res, next) => next();

/**
 * Sentry tracing handler middleware (v10 compatible no-op shim)
 * Tracing is handled automatically by httpIntegration.
 */
export const sentryTracingHandler = (req, res, next) => next();

/**
 * Sentry error handler middleware (v10 compatible)
 * Must be placed BEFORE the app's own error handler.
 */
export const sentryErrorHandler = (err, req, res, next) => {
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(err);
    }
    next(err);
};

/**
 * Wire up Sentry Express error handler on the app (call after all routes).
 * This replaces the deprecated Sentry.Handlers.errorHandler() from v7/v8.
 */
export const setupSentryErrorHandler = (app) => {
    if (process.env.SENTRY_DSN) {
        Sentry.setupExpressErrorHandler(app);
    }
};

/**
 * Manual error capture for non-Express errors
 */
export const captureException = (error, context = {}) => {
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(error, { extra: context });
    } else {
        console.error('[(Sentry Disabled) Error]:', error);
    }
};

/**
 * Manual message capture for logging
 */
export const captureMessage = (message, level = 'info') => {
    if (process.env.SENTRY_DSN) {
        Sentry.captureMessage(message, level);
    }
};

export default Sentry;
