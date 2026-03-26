

import helmet from 'helmet';

const commonDirectives = {
  defaultSrc: ["'self'"],
  imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  connectSrc: ["'self'", process.env.SUPABASE_URL || '*', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
};

const commonHelmetOptions = {
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
};

// Strict configuration for the core JSON API
export const securityHeaders = helmet({
  ...commonHelmetOptions,
  contentSecurityPolicy: {
    directives: {
      ...commonDirectives,
      scriptSrc: ["'self'", 'https://trusted-cdn.com'], // 'unsafe-inline' removed
      styleSrc: ["'self'", 'https://fonts.googleapis.com'], // 'unsafe-inline' removed
    },
  },
});

// Relaxed configuration exclusively for Swagger UI compatibility
export const swaggerSecurityHeaders = helmet({
  ...commonHelmetOptions,
  contentSecurityPolicy: {
    directives: {
      ...commonDirectives,
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://trusted-cdn.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    },
  },
});

// Additional custom security headers
export const customSecurityHeaders = (req, res, next) => {
  // Prevent browser from caching sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};
