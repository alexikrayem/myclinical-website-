import axios from 'axios';
import logger from '../config/logger.js';
import { AppError } from '../utils/errors.js';

const VDO_API_SECRET = process.env.VDOCIPHER_API_SECRET;
const VDO_BASE_URL = 'https://dev.vdocipher.com/api/videos';

/**
 * Get OTP and PlaybackInfo for a VdoCipher video
 * @param {string} videoId - The VdoCipher video ID
 * @param {object} options - Optional parameters like watermarking
 * @returns {Promise<{otp: string, playbackInfo: string}>}
 */
export const getVdoPlaybackInfo = async (videoId, options = {}) => {
    // Mock Mode for Development/Testing
    if (process.env.MOCK_VIDEO_API === 'true') {
        logger.info('Returning Mock Video Info for:', { videoId });
        return {
            otp: 'mock-otp-' + videoId,
            playbackInfo: 'mock-playback-info',
            isMock: true
        };
    }

    try {
        if (!VDO_API_SECRET) {
            throw new AppError('VDOCIPHER_API_SECRET is not configured', 500, 'VDOCIPHER_CONFIG_MISSING');
        }

        // Basic watermarking configuration if user info is available
        const annotate = options.user ? [
            {
                type: 'rtext',
                text: options.user.phone_number || options.user.id,
                alpha: '0.6',
                color: '0xFFFFFF',
                size: '15',
                interval: '5000'
            }
        ] : null;

        const response = await axios.post(
            `${VDO_BASE_URL}/${videoId}/otp`,
            {
                ttl: 3600, // 1 hour validity
                annotate: annotate ? JSON.stringify(annotate) : undefined
            },
            {
                timeout: 10000,
                headers: {
                    'Authorization': `Apisecret ${VDO_API_SECRET}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            otp: response.data.otp,
            playbackInfo: response.data.playbackInfo
        };
    } catch (error) {
        logger.error('VdoCipher API error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        throw new AppError('Failed to get video playback info', 502, 'VDOCIPHER_API_FAILED');
    }
};
