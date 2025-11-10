
export const SECURITY_CONFIG = {
  // CORS configuration
  cors: {
    development: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:5174',
    ],
    production: [
      'https://doctortabeeb.netlify.app',
      'https://iridescent-axolotl-f6b4f6.netlify.app',
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  },

  // Rate limiting configuration
  rateLimits: {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 5,
    },
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20,
    },
    ai: {
      windowMs: 60 * 60 * 1000,
      max: 10,
    },
    search: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30,
    },
  },

  // File upload configuration
  fileUpload: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ],
  },

  // Session configuration
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    checkInterval: 60 * 60 * 1000, // 1 hour
  },

  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },

  // Security headers
  headers: {
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  },
};

// Get CORS origins based on environment
export const getCorsOrigins = () => {
  const env = process.env.NODE_ENV || 'development';
  
  // Allow custom origins from environment variable
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  }
  
  return env === 'production' 
    ? SECURITY_CONFIG.cors.production 
    : SECURITY_CONFIG.cors.development;
};

// Validate password strength
export const validatePasswordStrength = (password) => {
  const config = SECURITY_CONFIG.password;
  const errors = [];

  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
