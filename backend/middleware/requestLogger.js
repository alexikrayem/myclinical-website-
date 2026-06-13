import logger from '../config/logger.js';

export const requestLogger = (req, res, next) => {
    // Skip health and security checks to reduce noise
    if (req.path === '/health' || req.path === '/security-status') {
        return next();
    }

    const start = Date.now();

    // Hook into response finish to log duration and status
    res.on('finish', () => {
        const duration = Date.now() - start;
        const isError = res.statusCode >= 400;
        const isSlow = duration > 500;

        // Strategic logging: Only log errors or slow requests
        if (isError || isSlow) {
            const logLevel = isError ? 'warn' : 'info';
            logger.log({
                level: logLevel,
                message: `${isSlow && !isError ? '[SLOW] ' : ''}${req.method} ${req.originalUrl}`,
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration: `${duration}ms`,
                userAgent: req.get('user-agent'),
                ip: req.ip
            });
        }
    });

    next();
};
