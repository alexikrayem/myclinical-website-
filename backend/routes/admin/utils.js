import path from 'path';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { AppError } from '../../utils/errors.js';
import logger from '../../config/logger.js';

/**
 * Upload a file to Supabase Storage
 * @param {Object} file - Multer file object
 * @param {string} bucket - Storage bucket name
 * @returns {string} Public URL of the uploaded file
 */
export const uploadToSupabase = async (file, bucket = 'images') => {
    try {
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) {
            logger.error('Supabase upload error:', error);
            throw new AppError('Database operation failed', 500, 'ADMIN_DB_ERROR');
        }

        const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    } catch (error) {
        logger.error('Error uploading to Supabase:', error);
        throw new AppError('Failed to upload file to Supabase', 500, 'UPLOAD_FAILED');
    }
};
