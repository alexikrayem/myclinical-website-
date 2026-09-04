import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import logger from './config/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import { requestId } from './middleware/requestId.js';
import promBundle from 'express-prom-bundle';

// Routes
import articlesRoutes from './routes/articles.js';
import researchRoutes from './routes/research.js';
import adminRoutes from './routes/admin.js';
import authorsRoutes from './routes/authors.js';
import aiRoutes from './routes/ai.js';
import coursesRoutes from './routes/courses.js';
import creditsRoutes from './routes/credits.js';
import userAuthRoutes from './routes/userAuth.js';
import uploadRoutes from './routes/upload.js';
import sitemapRoutes from './routes/sitemap.js';
import securePdfRoutes from './routes/securePdf.js';
import searchRoutes from './routes/search.js';
import meRoutes from './routes/me.js';
import shareRoutes from './routes/share.js';
import { setupSwagger } from './config/swagger.js';

// Security Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { securityHeaders, swaggerSecurityHeaders, customSecurityHeaders } from './middleware/securityHeaders.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sanitizeData, preventXSS, preventHPP, validateInput } from './middleware/inputSanitizer.js';
import { preventSensitiveFileAccess } from './middleware/fileValidation.js';
import { validateEnvironment, validateProductionSecurity, requireValidEnvironment } from './middleware/envValidator.js';
import { getCorsOrigins } from './config/security.js';
import { initSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler, setupSentryErrorHandler } from './config/sentry.js';

// Load and validate environment variables
dotenv.config();
validateEnvironment();
validateProductionSecurity();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Trace ID for every request
app.use(requestId);

// Initialize Sentry (must be before other middleware)
initSentry(app);
app.use(sentryRequestHandler);
app.use(sentryTracingHandler);

// Prometheus metrics collection
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { project_name: 'myclinical' },
  promClient: {
    collectDefaultMetrics: {}
  }
});
app.use(metricsMiddleware);

// Trust proxy (important for rate limiting and security when behind a proxy)
app.set('trust proxy', 1);

// Security Headers - Apply strict headers conditionally (Swagger UI needs relaxed CSP)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/docs')) {
    return swaggerSecurityHeaders(req, res, next);
  }
  return securityHeaders(req, res, next);
});
app.use(customSecurityHeaders);

// Response Compression
app.use(compression());

// Request Logging
app.use(requestLogger);

// CORS Configuration with security
app.use(cors({
  origin: getCorsOrigins(),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400, // 24 hours
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser for session management
app.use(cookieParser());

// Input sanitization and validation
app.use(sanitizeData);
app.use(preventXSS);
app.use(preventHPP);
app.use(validateInput);

// Environment validation middleware
app.use(requireValidEnvironment);

import { supabasePublic } from './config/supabase.js';
import { isRedisAvailable } from './config/redis.js';
import { isMeiliEnabled, getMeiliClient } from './services/search/meiliClient.js';

// Health check endpoint (verifies downstream dependencies)
app.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    security: 'enabled',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      supabase: 'UNKNOWN',
      redis: isRedisAvailable() ? 'CONNECTED' : 'DISCONNECTED',
      meilisearch: isMeiliEnabled() ? 'ENABLED' : 'DISABLED'
    }
  };

  // 1. Check Supabase Connectivity
  try {
    const { error } = await supabasePublic.from('articles').select('id', { count: 'exact', head: true }).limit(1);
    health.dependencies.supabase = error ? 'ERROR' : 'CONNECTED';
    if (error) health.status = 'DEGRADED';
  } catch (e) {
    health.dependencies.supabase = 'ERROR';
    health.status = 'DEGRADED';
  }

  // 2. Check Meilisearch (if enabled)
  if (isMeiliEnabled()) {
    try {
      const client = getMeiliClient();
      const isHealthy = await client.isHealthy();
      health.dependencies.meilisearch = isHealthy ? 'CONNECTED' : 'ERROR';
      if (!isHealthy) health.status = 'DEGRADED';
    } catch (e) {
      health.dependencies.meilisearch = 'ERROR';
      health.status = 'DEGRADED';
    }
  }

  // Return 200 if OK/DEGRADED, but potentially 503 if CRITICAL dependencies are down
  // For now, return 200 to allow monitoring tools to see the JSON
  res.status(health.status === 'OK' ? 200 : 207).json(health);
});

// (REMOVED security-status endpoint)


// Serve uploads directory with security checks
app.use('/uploads', preventSensitiveFileAccess, express.static(path.join(__dirname, '../uploads'), {
  dotfiles: 'deny', // Don't serve hidden files
  index: false, // Don't serve directory indexes
  setHeaders: (res, filePath) => {
    // Add security headers for uploaded files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent direct execution of uploaded files
    res.setHeader('Content-Disposition', 'attachment');
  }
}));

// Apply general API rate limiting to all API routes
app.use('/api/', apiLimiter);

// Setup API Documentation (Swagger)
setupSwagger(app);

// API Routes
app.use('/api/articles', articlesRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/research', securePdfRoutes); // Secure PDF viewing
app.use('/api/admin', adminRoutes);
app.use('/api/authors', authorsRoutes);
app.use('/api/ai', aiRoutes);
const ENABLE_COURSES = process.env.ENABLE_COURSES !== 'false';
if (ENABLE_COURSES) {
  app.use('/api/courses', coursesRoutes);
}
app.use('/api/credits', creditsRoutes);
app.use('/api/auth', userAuthRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/me', meRoutes);

// SEO Routes (no /api prefix)
app.use('/', shareRoutes);
app.use('/', sitemapRoutes);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Sentry error handler — must be BEFORE the app error handler (v10: setupExpressErrorHandler)
setupSentryErrorHandler(app);

// Error handling middleware
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/health`);
    logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;
