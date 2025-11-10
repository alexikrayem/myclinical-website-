// Secure error handler that prevents information leakage
export const errorHandler = (err, req, res, next) => {
  // Log full error for debugging (only in server logs)
  if (process.env.NODE_ENV === 'development') {
    console.error('Error details:', err);
  } else {
    // In production, log only essential info
    console.error('Error:', {
      message: err.message,
      code: err.code,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large. Maximum size is 5MB.',
      code: 'FILE_TOO_LARGE'
    });
  }
  
  // Handle other multer errors
  if (err.code && err.code.startsWith('LIMIT_')) {
    return res.status(400).json({
      error: 'File upload limit exceeded',
      code: 'UPLOAD_LIMIT_EXCEEDED'
    });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  // Handle Supabase errors
  if (err.code && err.code.startsWith('PGRST')) {
    return res.status(400).json({
      error: 'Database operation failed',
      code: 'DATABASE_ERROR'
    });
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid authentication token',
      code: 'INVALID_TOKEN'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication token expired',
      code: 'TOKEN_EXPIRED'
    });
  }
  
  // Handle specific error types
  if (err.status === 404) {
    return res.status(404).json({
      error: 'Resource not found',
      code: 'NOT_FOUND'
    });
  }
  
  if (err.status === 403) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'FORBIDDEN'
    });
  }
  
  // Default error response (hide details in production)
  const statusCode = err.status || 500;
  const errorMessage = process.env.NODE_ENV === 'development' 
    ? err.message || 'Internal Server Error'
    : 'An error occurred processing your request';
  
  res.status(statusCode).json({
    error: errorMessage,
    code: 'INTERNAL_ERROR',
    requestId: req.id || undefined, // If you add request ID middleware
  });
};