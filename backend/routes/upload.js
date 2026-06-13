import express from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../middleware/auth.js';
import { supabaseAdmin as supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';
import { validateFileSignature } from '../utils/fileValidation.js';

const router = express.Router();


// Configure Storage - Memory storage for direct upload to Supabase
const storage = multer.memoryStorage();

// File Filter (Initial basic check)
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Images only! (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: fileFilter
});

/**
 * @route POST /api/upload
 * @desc Upload an image for the editor
 * @access Admin
 */
router.post('/', authenticateToken, upload.single('image'), asyncHandler(async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Deep Magic Byte Validation
        const signature = await validateFileSignature(req.file.buffer, [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp'
        ]);

        if (!signature.valid) {
            return res.status(400).json({
                error: 'Invalid file signature. The file content does not match its extension.',
                code: 'INVALID_FILE_SIGNATURE'
            });
        }

        let fileBuffer = req.file.buffer;
        let contentType = req.file.mimetype;
        const fileExt = path.extname(req.file.originalname); // .jpg
        let filename = `editor-${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;

        try {
            // Try to load sharp dynamically
            const sharpModule = await import('sharp');
            const sharp = sharpModule.default;

            // Optimize image
            fileBuffer = await sharp(req.file.buffer)
                .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true }) // Max HD size
                .webp({ quality: 80 }) // Convert to WebP
                .toBuffer();

            contentType = 'image/webp';
            filename = filename.replace(/\.[^/.]+$/, "") + ".webp";

        } catch (sharpError) {
            logger.warn('Sharp optimization failed or not installed, uploading original file:', { message: sharpError.message });
        }

        // Upload to Supabase
        const { data, error } = await supabase.storage
            .from('images') // Using 'images' bucket as per plan
            .upload(filename, fileBuffer, {
                contentType: contentType,
                upsert: false
            });

        if (error) {
            throw new AppError('Failed to upload image', 500, 'UPLOAD_FAILED');
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from('images')
            .getPublicUrl(filename);

        res.json({
            success: true,
            url: publicUrlData.publicUrl,
            filename: filename
        });
    } catch (error) {
        logger.error('Upload Error:', { message: error.message });
        throw new AppError('Failed to upload image', 500, 'UPLOAD_FAILED');
    }
}));

export default router;
