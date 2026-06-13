import fsPromises from 'fs/promises';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';
import { sanitizeFileName } from './inputSanitizer.js';
import logger from '../config/logger.js';
import path from 'path';
import fs from 'fs';

// File types that don't have magic numbers - validate by content analysis
const TEXT_BASED_TYPES = ['txt'];

// Validate text file content (ensure it's valid UTF-8 text, not binary)
const isValidTextFile = (buffer) => {
  // Check for NULL bytes in first 8KB (common indicator of binary content)
  const checkLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) return false;
  }
  return true;
};


/**
 * Validates a file type asynchronously using magic bytes
 * @param {Buffer|string} input - The file buffer or path
 * @param {string[]} allowedTypes - Array of allowed file types/extensions
 * @returns {Promise<{valid: boolean, type: string|null}>}
 */
export const validateFileTypeAsync = async (input, allowedTypes = ['pdf', 'jpg', 'png', 'doc', 'docx']) => {
  try {
    let type;
    if (Buffer.isBuffer(input)) {
      type = await fileTypeFromBuffer(input);
    } else if (typeof input === 'string') {
      type = await fileTypeFromFile(input);
    }

    if (!type) {
      // Fallback for text-based files
      const isTextAllowed = allowedTypes.includes('txt');
      if (isTextAllowed) {
        const buffer = Buffer.isBuffer(input) ? input : await fsPromises.readFile(input);
        if (isValidTextFile(buffer)) {
          return { valid: true, type: 'txt' };
        }
      }
      return { valid: false, type: null };
    }

    // Standardize comparison (e.g. jpeg -> jpg)
    let detectedExt = type.ext;
    if (detectedExt === 'jpeg') {
      detectedExt = 'jpg';
    }

    const isValid = allowedTypes.includes(detectedExt);
    return { valid: isValid, type: detectedExt };
  } catch (error) {
    logger.error('File type validation error:', error);
    return { valid: false, type: null };
  }
};


// Middleware to validate uploaded files (async)
export const validateUploadedFile = (allowedTypes = ['pdf', 'jpg', 'png', 'doc', 'docx']) => {
  return async (req, res, next) => {
    if (!req.file) {
      return next();
    }

    // Validate file size
    const maxSize = process.env.MAX_FILE_SIZE || 5242880; // 5MB default
    if (req.file.size > maxSize) {
      // Cleanup for disk storage
      if (req.file.path) {
        try {
          await fsPromises.unlink(req.file.path);
        } catch (unlinkError) {
          logger.error('Error deleting oversized file:', unlinkError);
        }
      }
      return res.status(400).json({
        error: `File too large. Maximum size is ${Math.floor(maxSize / 1024 / 1024)}MB`,
        code: 'FILE_TOO_LARGE'
      });
    }

    const input = req.file.buffer || req.file.path;
    const validation = await validateFileTypeAsync(input, allowedTypes);

    if (!validation.valid) {
      logger.warn(`File validation failed. Type: ${validation.type}, Allowed: ${allowedTypes.join(', ')}`);

      // Cleanup for disk storage
      if (req.file.path) {
        try {
          await fsPromises.unlink(req.file.path);
        } catch (unlinkError) {
          logger.error('Error deleting invalid file:', unlinkError);
        }
      }
      return res.status(400).json({
        error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Sanitize filename
    req.file.originalname = sanitizeFileName(req.file.originalname);

    // Handle renaming for disk storage (if applicable)
    if (req.file.path) {
      const sanitizedName = req.file.originalname;
      const newPath = path.join(path.dirname(req.file.path), `${Date.now()}-${sanitizedName}`);
      try {
        await fsPromises.rename(req.file.path, newPath);
        req.file.path = newPath;
        req.file.filename = path.basename(newPath);
      } catch (error) {
        logger.error('Error processing file on disk:', error);
        return res.status(500).json({ error: 'Error processing file' });
      }
    }

    next();
  };
};


// Secure file access validation (async)
export const validateFileAccessAsync = async (filePath) => {
  const uploadsDir = path.resolve('uploads');
  const requestedPath = path.resolve(filePath);

  // Ensure the file is within the uploads directory (prevent path confusion and traversal)
  if (requestedPath !== uploadsDir && !requestedPath.startsWith(uploadsDir + path.sep)) {
    return false;
  }

  // Check if file exists
  try {
    await fsPromises.access(requestedPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

// Legacy sync version for backwards compatibility (deprecated)
export const validateFileAccess = (filePath) => {
  const uploadsDir = path.resolve('uploads');
  const requestedPath = path.resolve(filePath);

  // Ensure the file is within the uploads directory (prevent path confusion and traversal)
  if (requestedPath !== uploadsDir && !requestedPath.startsWith(uploadsDir + path.sep)) {
    return false;
  }

  // Check if file exists
  if (!fs.existsSync(requestedPath)) {
    return false;
  }

  return true;
};

// Middleware to prevent direct access to sensitive files
export const preventSensitiveFileAccess = (req, res, next) => {
  const filePath = req.path;

  // Block access to sensitive system files/directories.
  // NOTE: These patterns are anchored to prevent false-positives on legitimate
  // medical content file names (e.g. 'keyboard-anatomy.pdf', 'turkey-dental.jpg').
  const blockedPatterns = [
    /(\/|^)\.env(\.|$)/i,          // .env, .env.local, etc.
    /(\/|^)\.git(\/|$)/i,          // .git directory
    /(\/|^)\.ssh(\/|$)/i,          // .ssh directory
    /(\/|^)node_modules(\/|$)/i,   // node_modules directory
    /(\/|^)\.htaccess$/i,           // .htaccess files
    /\.pem$/i,                      // PEM certificate/key files
    /\.key$/i,                      // Explicit .key extension only
    /\.pfx$/i,                      // PFX certificate files
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(filePath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  next();
};
