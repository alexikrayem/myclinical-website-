import crypto from 'crypto';

/**
 * Middleware to add a unique ID to every request
 */
export const requestId = (req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
};
