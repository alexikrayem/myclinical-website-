import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cookieParser from 'cookie-parser';

// Routes
import articlesRoutes from './routes/articles.js';
import researchRoutes from './routes/research.js';
import adminRoutes from './routes/admin.js';
import authorsRoutes from './routes/authors.js';
import aiRoutes from './routes/ai.js';

// Security Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { securityHeaders, customSecurityHeaders } from './middleware/securityHeaders.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sanitizeData, preventXSS, preventHPP, validateInput } from './middleware/inputSanitizer.js';
import { preventSensitiveFileAccess } from './middleware/fileValidation.js';
import { validateEnvironment, validateProductionSecurity, requireValidEnvironment } from './middleware/envValidator.js';
import { getCorsOrigins } from './config/security.js';

// Load and validate environment variables
dotenv.config();
validateEnvironment();
validateProductionSecurity();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Trust proxy (important for rate limiting and security when behind a proxy)
app.set('trust proxy', 1);

// Security Headers - Apply first
app.use(securityHeaders);
app.use(customSecurityHeaders);

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
app.use(sanitizeData); // Prevent NoSQL injection
app.use(preventXSS); // Prevent XSS attacks
app.use(preventHPP); // Prevent HTTP Parameter Pollution
app.use(validateInput); // Custom input validation

// Environment validation middleware
app.use(requireValidEnvironment);

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    security: 'enabled'
  });
});

// Security status endpoint (for monitoring)
app.get('/security-status', (req, res) => {
  res.json({
    headers: 'enabled',
    rateLimiting: 'enabled',
    inputSanitization: 'enabled',
    cors: 'configured',
    fileValidation: 'enabled',
    timestamp: new Date().toISOString()
  });
});

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, JPG, JPEG, and PNG files are allowed!'));
    }
  }
});

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

// API Routes
app.use('/api/articles', articlesRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/authors', authorsRoutes);
app.use('/api/ai', aiRoutes);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;