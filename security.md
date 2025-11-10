"# Security Documentation

## Overview
This document outlines the security measures implemented in the Arabic Dental Research Platform to protect against common web vulnerabilities and ensure data safety.

## Security Features Implemented

### 1. Security Headers
- **Helmet.js**: Comprehensive security headers middleware
  - Content Security Policy (CSP)
  - HTTP Strict Transport Security (HSTS)
  - X-Frame-Options (Clickjacking protection)
  - X-Content-Type-Options (MIME sniffing prevention)
  - X-XSS-Protection
  - Referrer Policy
  - Permissions Policy

### 2. Rate Limiting
Protection against brute force and DDoS attacks:

| Endpoint Type | Window | Max Requests | Purpose |
|--------------|--------|--------------|---------|
| General API | 15 min | 100 requests | Prevent API abuse |
| Authentication | 15 min | 5 attempts | Prevent brute force login |
| File Upload | 1 hour | 20 uploads | Limit resource usage |
| AI Generation | 1 hour | 10 requests | Control expensive operations |
| Search | 1 minute | 30 searches | Prevent search spam |

### 3. Input Validation & Sanitization
- **MongoDB Injection Prevention**: All inputs sanitized using express-mongo-sanitize
- **XSS Protection**: Cleaned using xss-clean middleware
- **HTTP Parameter Pollution**: Prevented using hpp middleware
- **Null Byte Detection**: Custom validation for null bytes in inputs
- **File Name Sanitization**: Removes path traversal attempts and special characters

### 4. Authentication & Authorization
- **Supabase Auth Integration**: Secure authentication flow
- **JWT Token Verification**: All admin routes protected
- **Account Lockout**: After 5 failed login attempts, account locked for 15 minutes
- **Session Management**: Secure cookie-based sessions with httpOnly flag
- **Role-Based Access Control**: Admin role verification on protected routes

### 5. File Upload Security
- **Magic Number Validation**: Files validated by content, not just extension
- **File Size Limits**: Maximum 5MB per file
- **Allowed File Types**: Only PDF, DOC, DOCX, JPG, PNG
- **Path Traversal Prevention**: Sanitized file names and paths
- **Secure Storage**: Files served with security headers
- **Direct Execution Prevention**: Content-Disposition header set to attachment

### 6. CORS Configuration
- **Environment-Based Origins**: Different allowed origins for dev/production
- **Credential Support**: Properly configured for cookie-based auth
- **Method Restrictions**: Only necessary HTTP methods allowed
- **Header Whitelist**: Only required headers exposed

### 7. Error Handling
- **Information Hiding**: Production errors don't expose stack traces
- **Structured Error Responses**: Consistent error format with error codes
- **Secure Logging**: Full errors logged server-side only
- **User-Friendly Messages**: Generic messages to users, detailed logs for admins

### 8. Environment Security
- **Startup Validation**: Required environment variables checked on startup
- **Configuration Validation**: Format and value validation
- **Secret Strength Checks**: JWT secrets must be 32+ characters in production
- **No Default Credentials**: Check for placeholder values

### 9. HTTPS & Transport Security
- **HSTS Enabled**: Force HTTPS in production
- **Secure Cookies**: Cookies marked as secure in production
- **TLS Required**: Production environment enforces HTTPS

### 10. Monitoring & Logging
- **Security Event Logging**: Failed login attempts, blocked requests
- **Request Tracking**: Timestamp and path logging for security events
- **Health Check Endpoint**: `/health` for monitoring
- **Security Status Endpoint**: `/security-status` for verification

## Configuration

### Required Environment Variables
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NODE_ENV=production
JWT_SECRET=minimum_32_character_random_string
```

### Optional Environment Variables
```env
PORT=5000
MAX_FILE_SIZE=5242880
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
STRICT_SECURITY=true
```

## Security Best Practices

### For Administrators
1. **Change Default Credentials**: Immediately change the default admin password
2. **Use Strong Passwords**: Minimum 8 characters with uppercase, lowercase, numbers, and special characters
3. **Enable 2FA**: If available through Supabase Auth
4. **Regular Updates**: Keep dependencies updated
5. **Monitor Logs**: Regularly check logs for suspicious activity
6. **Backup Data**: Regular database backups
7. **API Key Rotation**: Rotate Supabase keys periodically

### For Developers
1. **Never Commit Secrets**: Keep .env out of version control
2. **Use Environment Variables**: Never hardcode credentials
3. **Validate All Inputs**: Server-side validation is mandatory
4. **Sanitize User Content**: Especially for rich text fields
5. **Least Privilege**: Users should have minimum necessary permissions
6. **Security Testing**: Regular security audits and penetration testing
7. **Dependency Audits**: Run `npm audit` regularly

### For Deployment
1. **Use HTTPS**: Always use SSL/TLS certificates
2. **Firewall Configuration**: Limit access to necessary ports only
3. **Regular Backups**: Automated backup strategy
4. **Monitoring**: Set up alerts for security events
5. **Update Strategy**: Regular security patches
6. **Access Control**: Limit server access to authorized personnel

## Security Checklist

Before deploying to production:

- [ ] All environment variables properly set
- [ ] Default admin credentials changed
- [ ] HTTPS enabled with valid certificate
- [ ] Strong JWT_SECRET configured (32+ characters)
- [ ] CORS origins properly configured
- [ ] Rate limiting tested and working
- [ ] File upload restrictions verified
- [ ] Error handling hides sensitive information
- [ ] Security headers verified (use securityheaders.com)
- [ ] All dependencies up to date
- [ ] Database backups configured
- [ ] Monitoring and logging set up
- [ ] Security audit completed

## Incident Response

If a security issue is discovered:

1. **Immediate Actions**:
   - Identify and document the issue
   - Assess the scope of impact
   - Contain the threat (disable affected features if necessary)

2. **Investigation**:
   - Review logs for exploitation attempts
   - Identify compromised data/accounts
   - Determine attack vector

3. **Remediation**:
   - Apply security patch
   - Update affected systems
   - Reset compromised credentials
   - Notify affected users if data breach occurred

4. **Prevention**:
   - Update security measures
   - Implement additional monitoring
   - Document lessons learned
   - Update security policies

## Reporting Security Issues

If you discover a security vulnerability, please report it to:
- Email: security@arabdental.com (create this email for production)
- Do NOT create public GitHub issues for security vulnerabilities
- Include: description, steps to reproduce, impact assessment

## Compliance

This platform implements security measures compliant with:
- OWASP Top 10 security risks
- General Data Protection Regulation (GDPR) principles
- Healthcare data protection standards (for medical content)

## Security Audit Log

| Date | Version | Auditor | Status | Notes |
|------|---------|---------|--------|-------|
| 2025-01-XX | 1.0.0 | Initial | ✅ Passed | Initial security implementation |

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)

---

Last Updated: 2025-01-XX
Version: 1.0.0
"