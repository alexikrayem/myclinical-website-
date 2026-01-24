import logger from '../config/logger.js';

export const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log request start
    // logger.info(`Incoming ${req.method} ${req.originalUrl}`);

    // Hook into response finish to log duration and status
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

        logger.log({
            level: logLevel,
            message: `${req.method} ${req.originalUrl}`,
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('user-agent'),
            ip: req.ip
        });
    });

    next();
};
