

import dotenv from 'dotenv';

dotenv.config();

// Required environment variables
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NODE_ENV',
];

// Optional but recommended environment variables
const RECOMMENDED_ENV_VARS = [
  'JWT_SECRET',
  'MAX_FILE_SIZE',
  'PORT',
];

// Validate environment variables on startup
export const validateEnvironment = () => {
  const missing = [];
  const warnings = [];
  
  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  // Check recommended variables
  for (const varName of RECOMMENDED_ENV_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }
  
// Report missing required variables
if (missing.length > 0) {
  console.error('❌ CRITICAL: Missing required environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.error('\nPlease set these variables in your .env file before starting the server.');
  process.exit(1);
}
  
  // Report missing recommended variables
// Report missing recommended variables
if (warnings.length > 0) {
  console.warn('⚠️  Warning: Missing recommended environment variables:');
  warnings.forEach(v => console.warn(`   - ${v}`));
  console.warn('\nThe server will use default values, but it\'s recommended to set these explicitly.\n');
}
  // Validate Supabase URL format
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith('https://')) {
    console.error('❌ CRITICAL: SUPABASE_URL must be a valid HTTPS URL');
    process.exit(1);
  }
  
  // Validate NODE_ENV
  const validEnvs = ['development', 'production', 'test'];
  if (process.env.NODE_ENV && !validEnvs.includes(process.env.NODE_ENV)) {
    console.warn(`⚠️  Warning: NODE_ENV \"${process.env.NODE_ENV}\" is not standard. Expected: ${validEnvs.join(', ')}`);
  }
  
  // Validate PORT if set
  if (process.env.PORT && (isNaN(process.env.PORT) || process.env.PORT < 1 || process.env.PORT > 65535)) {
    console.error('❌ CRITICAL: PORT must be a number between 1 and 65535');
    process.exit(1);
  }
  
  // Validate MAX_FILE_SIZE if set
  if (process.env.MAX_FILE_SIZE && isNaN(process.env.MAX_FILE_SIZE)) {
    console.error('❌ CRITICAL: MAX_FILE_SIZE must be a number (in bytes)');
    process.exit(1);
  }
  
  // Check for default/example values that should be changed
  const exampleValues = ['your_supabase_url', 'your_supabase_anon_key', 'your_jwt_secret'];
  for (const varName of REQUIRED_ENV_VARS) {
    if (process.env[varName] && exampleValues.some(ex => process.env[varName].includes(ex))) {
      console.error(`❌ CRITICAL: ${varName} appears to contain a placeholder value. Please update your .env file with actual credentials.`);
      process.exit(1);
    }
  }
  
  console.log('✅ Environment validation passed');
};
export const validateProductionSecurity = () => {
  if (process.env.NODE_ENV === 'production') {
    const securityIssues = [];
    
    // Check JWT_SECRET strength
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      securityIssues.push('JWT_SECRET should be at least 32 characters long');
    }
    
    // Check if using default admin credentials (if we can check)
    // This would require database access, so just warn
    console.warn('⚠️  SECURITY: Ensure you have changed default admin credentials!');
    
    if (securityIssues.length > 0) {
      console.error('❌ SECURITY ISSUES in production:');
      securityIssues.forEach(issue => console.error(`   - ${issue}`));
      console.error('\nPlease fix these security issues before deploying to production.\n');
      
      // In strict mode, exit
      if (process.env.STRICT_SECURITY === 'true') {
        process.exit(1);
      }
    }
  }
};

 // Middleware to check if environment is properly configured
export const requireValidEnvironment = (req, res, next) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({
      error: 'Service temporarily unavailable - configuration error',
      code: 'CONFIG_ERROR'
    });
  }
  next();
};
