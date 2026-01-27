import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry for error monitoring
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
            // Enable HTTP calls tracing
            Sentry.httpIntegration({ tracing: true }),
            // Enable Express tracing
            Sentry.expressIntegration({ app }),
        ],
    });

    console.log('✅ Sentry error monitoring initialized');
};

/**
 * Sentry request handler middleware
 * Must be the first middleware
 */
export const sentryRequestHandler = (req, res, next) => {
    if (Sentry.Handlers && Sentry.Handlers.requestHandler) {
        return Sentry.Handlers.requestHandler()(req, res, next);
    }
    next();
};

/**
 * Sentry tracing handler middleware
 * Must be after request handler
 */
export const sentryTracingHandler = (req, res, next) => {
    if (Sentry.Handlers && Sentry.Handlers.tracingHandler) {
        return Sentry.Handlers.tracingHandler()(req, res, next);
    }
    next();
};

/**
 * Sentry error handler middleware
 * Must be before any other error handlers
 */
export const sentryErrorHandler = (err, req, res, next) => {
    if (Sentry.Handlers && Sentry.Handlers.errorHandler) {
        return Sentry.Handlers.errorHandler()(err, req, res, next);
    }
    // Manual capture for newer SDKs if Handlers is missing but DSN is present
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(err);
    }
    next(err);
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
    } else {
        // Optional: console.log(`[(Sentry Disabled) Message]: ${message}`);
    }
};

export default Sentry;
