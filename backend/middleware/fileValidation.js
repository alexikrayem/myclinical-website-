import fs from 'fs'
import path from 'path';
import { sanitizeFileName } from './inputSanitizer.js';

// File type magic numbers for validation
const FILE_SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  jpg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  doc: [0xD0, 0xCF, 0x11, 0xE0],
  docx: [0x50, 0x4B, 0x03, 0x04], // ZIP-based
};

// Validate file type using magic numbers (not just extension)
export const validateFileType = (filePath, allowedTypes = ['pdf', 'jpg', 'png', 'doc', 'docx']) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const fileHeader = Array.from(buffer.slice(0, 8));

    for (const type of allowedTypes) {
      const signature = FILE_SIGNATURES[type];
      if (signature && signature.every((byte, index) => fileHeader[index] === byte)) {
        return { valid: true, type };
      }
    }

    return { valid: false, type: null };
  } catch (error) {
    console.error('File validation error:', error);
    return { valid: false, type: null };
  }
};

// Middleware to validate uploaded files
export const validateUploadedFile = (allowedTypes = ['pdf', 'jpg', 'png', 'doc', 'docx']) => {
  return (req, res, next) => {
    if (!req.file) {
      return next();
    }

    // Validate file size
    const maxSize = process.env.MAX_FILE_SIZE || 5242880; // 5MB default
    if (req.file.size > maxSize) {
      fs.unlinkSync(req.file.path); // Delete the file
      return res.status(400).json({ 
        error: `File too large. Maximum size is ${Math.floor(maxSize / 1024 / 1024)}MB` 
      });
    }

    // Validate file type using magic numbers
    const validation = validateFileType(req.file.path, allowedTypes);
    if (!validation.valid) {
      fs.unlinkSync(req.file.path); // Delete the file
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.' 
      });
    }

    // Sanitize filename
    const sanitizedName = sanitizeFileName(req.file.originalname);
    const newPath = path.join(path.dirname(req.file.path), sanitizedName);
    
    // Rename file to sanitized name
    try {
      fs.renameSync(req.file.path, newPath);
      req.file.path = newPath;
      req.file.filename = sanitizedName;
    } catch (error) {
      console.error('Error renaming file:', error);
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Error processing uploaded file' });
    }

    next();
  };
};

// Secure file access validation
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
