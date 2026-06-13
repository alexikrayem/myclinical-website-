import { fileTypeFromBuffer } from 'file-type';
import logger from '../config/logger.js';

/**
 * Validates a file buffer against allowed mime types using magic bytes
 * @param {Buffer} buffer - The file buffer to check
 * @param {string[]} allowedMimes - Array of allowed mime types
 * @returns {Promise<{valid: boolean, ext: string, mime: string}>}
 */
export const validateFileSignature = async (buffer, allowedMimes) => {
    try {
        const type = await fileTypeFromBuffer(buffer);

        if (!type) {
            return { valid: false, error: 'Could not determine file type' };
        }

        const isValid = allowedMimes.includes(type.mime);

        return {
            valid: isValid,
            ext: type.ext,
            mime: type.mime
        };
    } catch (error) {
        logger.error('Error validating file signature:', error);
        return { valid: false, error: 'Validation error' };
    }
};
