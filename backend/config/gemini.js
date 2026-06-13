import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from './logger.js';

const API_KEY = process.env.GEMINI_API_KEY;

let geminiModel = null;

if (API_KEY) {
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    // Configured for generation tasks needing solid reasoning
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    logger.info('Gemini AI successfully initialized');
  } catch (error) {
    logger.error('Failed to initialize Gemini AI', { error });
  }
} else {
  logger.warn('GEMINI_API_KEY is missing. AI features will be disabled.');
}

/**
 * Get the configured Gemini generative model instance
 * @returns {import('@google/generative-ai').GenerativeModel|null} The initialized generative model, or null if unconfigured
 */
export const getGenerativeModel = () => {
  return geminiModel;
};

export default getGenerativeModel;
