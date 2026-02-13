import fs from 'fs'
import fsPromises from 'fs/promises';
import path from 'path';
import { sanitizeFileName } from './inputSanitizer.js';

// File type magic numbers for validation
const FILE_SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  jpg: [0xFF, 0xD8, 0xFF],
  jpeg: [0xFF, 0xD8, 0xFF], // Alias for jpg
  png: [0x89, 0x50, 0x4E, 0x47],
  gif: [0x47, 0x49, 0x46, 0x38], // GIF8 (GIF87a or GIF89a)
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF container (requires additional WEBP check)
  doc: [0xD0, 0xCF, 0x11, 0xE0],
  docx: [0x50, 0x4B, 0x03, 0x04], // ZIP-based
};

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

// Validate file type using magic numbers (async version)
export const validateFileTypeAsync = async (filePath, allowedTypes = ['pdf', 'jpg', 'png', 'doc', 'docx']) => {
  try {
    const buffer = await fsPromises.readFile(filePath);
    const fileHeader = Array.from(buffer.slice(0, 8));

    // Check magic-number based types first
    for (const type of allowedTypes) {
      const signature = FILE_SIGNATURES[type];
      if (signature && signature.every((byte, index) => fileHeader[index] === byte)) {
        return { valid: true, type };
      }
    }

    // Check text-based types (no magic number - validate content)
    for (const type of allowedTypes) {
      if (TEXT_BASED_TYPES.includes(type) && isValidTextFile(buffer)) {
        return { valid: true, type };
      }
    }

    return { valid: false, type: null };
  } catch (error) {
    console.error('File validation error:', error);
    return { valid: false, type: null };
  }
};

// Legacy sync version for backwards compatibility (deprecated)
export const validateFileType = (filePath, allowedTypes = ['pdf', 'jpg', 'png', 'doc', 'docx']) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const fileHeader = Array.from(buffer.slice(0, 8));

    // Check magic-number based types first
    for (const type of allowedTypes) {
      const signature = FILE_SIGNATURES[type];
      if (signature && signature.every((byte, index) => fileHeader[index] === byte)) {
        return { valid: true, type };
      }
    }

    // Check text-based types (no magic number - validate content)
    for (const type of allowedTypes) {
      if (TEXT_BASED_TYPES.includes(type) && isValidTextFile(buffer)) {
        return { valid: true, type };
      }
    }

    return { valid: false, type: null };
  } catch (error) {
    console.error('File validation error:', error);
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
      // For disk storage, delete the file
      if (req.file.path) {
        try {
          await fsPromises.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting oversized file:', unlinkError);
        }
      }
      return res.status(400).json({
        error: `File too large. Maximum size is ${Math.floor(maxSize / 1024 / 1024)}MB`
      });
    }

    // For memory storage (req.file.buffer exists, no req.file.path)
    if (req.file.buffer && !req.file.path) {
      // Validate using buffer
      const fileHeader = Array.from(req.file.buffer.slice(0, 8));
      let isValid = false;

      // Check magic-number based types first
      for (const type of allowedTypes) {
        const signature = FILE_SIGNATURES[type];
        if (signature && signature.every((byte, index) => fileHeader[index] === byte)) {
          isValid = true;
          break;
        }
      }

      // Check text-based types if not validated yet
      if (!isValid) {
        for (const type of allowedTypes) {
          if (TEXT_BASED_TYPES.includes(type) && isValidTextFile(req.file.buffer)) {
            isValid = true;
            break;
          }
        }
      }

      if (!isValid) {
        return res.status(400).json({
          error: 'Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.'
        });
      }

      // Sanitize filename for memory storage
      req.file.originalname = sanitizeFileName(req.file.originalname);
      return next();
    }

    // For disk storage (original implementation)
    if (req.file.path) {
      // Validate file type using magic numbers
      const validation = await validateFileTypeAsync(req.file.path, allowedTypes);
      if (!validation.valid) {
        try {
          await fsPromises.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting invalid file:', unlinkError);
        }
        return res.status(400).json({
          error: 'Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.'
        });
      }

      // Sanitize filename
      const sanitizedName = sanitizeFileName(req.file.originalname);
      const newPath = path.join(path.dirname(req.file.path), sanitizedName);

      try {
        await fsPromises.rename(req.file.path, newPath);
        req.file.path = newPath;
        req.file.filename = sanitizedName;
      } catch (error) {
        console.error('Error renaming file:', error);
        try {
          await fsPromises.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting file after rename failure:', unlinkError);
        }
        return res.status(500).json({ error: 'Error processing uploaded file' });
      }
    }

    next();
  };
};

// Secure file access validation (async)
export const validateFileAccessAsync = async (filePath) => {
  const uploadsDir = path.resolve('uploads');
  const requestedPath = path.resolve(filePath);

  // Ensure the file is within the uploads directory (prevent path traversal)
  if (!requestedPath.startsWith(uploadsDir)) {
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

  // Ensure the file is within the uploads directory (prevent path traversal)
  if (!requestedPath.startsWith(uploadsDir)) {
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

  // List of patterns that should not be accessible
  const blockedPatterns = [
    /\.env/i,
    /\.git/i,
    /\.ssh/i,
    /config/i,
    /password/i,
    /secret/i,
    /key/i,
    /node_modules/i,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(filePath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  next();
};
