import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { authenticateToken } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ai-upload-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /pdf|txt|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /application\/pdf|text\/plain|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, DOC, and DOCX files are allowed!'));
    }
  }
});

// Helper function to extract text from uploaded files
async function extractTextFromFile(filePath, mimetype) {
  try {
    if (mimetype === 'text/plain') {
      return fs.readFileSync(filePath, 'utf8');
    } else if (mimetype === 'application/pdf') {
      // For PDF files, we'll need a PDF parser
      // For now, return a placeholder - you can integrate pdf-parse or similar
      return 'PDF content extraction would be implemented here with pdf-parse library';
    } else if (mimetype.includes('word')) {
      // For Word documents, you can use mammoth.js or similar
      return 'Word document content extraction would be implemented here with mammoth.js';
    }
    return '';
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error('Failed to extract text from file');
  }
}

// Generate article content using Gemini AI
router.post('/generate-content', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { textInput, language = 'arabic', contentType = 'article' } = req.body;
    let inputText = '';

    // Get input text from either file upload or direct text input
    if (req.file) {
      inputText = await extractTextFromFile(req.file.path, req.file.mimetype);
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
    } else if (textInput) {
      inputText = textInput;
    } else {
      return res.status(400).json({ error: 'Either file upload or text input is required' });
    }

    if (!inputText.trim()) {
      return res.status(400).json({ error: 'No content found to process' });
    }

    // Prepare the prompt for Gemini
    const prompt = `
You are a professional medical content writer specializing in dental medicine. Your task is to transform the provided research content into a well-structured, engaging article suitable for a dental professional audience.

Input Content:
${inputText}

Requirements:
- Language: ${language === 'arabic' ? 'Arabic' : 'English'}
- Content Type: ${contentType}
- Target Audience: Dental professionals, students, and practitioners
- Tone: Professional, informative, and accessible

Please generate ONLY the main article content (body text) in HTML format with proper headings, paragraphs, and lists. Do NOT include title, author, or metadata - only the article body content.

Structure the content with:
- Clear introduction
- Well-organized main sections with H2 and H3 headings
- Bullet points or numbered lists where appropriate
- Professional conclusion
- Proper HTML formatting (h2, h3, p, ul, ol, li tags)

Make sure the content is:
- Medically accurate and professional
- Well-structured and easy to read
- Engaging for dental professionals
- Properly formatted in HTML
`;

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedContent = response.text();

    // Clean up the generated content (remove any unwanted formatting)
    const cleanContent = generatedContent
      .replace(/```html/g, '')
      .replace(/```/g, '')
      .trim();

    res.json({
      success: true,
      content: cleanContent,
      message: 'Content generated successfully'
    });

  } catch (error) {
    console.error('Error generating content with Gemini AI:', error);
    
    // Handle specific Gemini API errors
    if (error.message.includes('API_KEY')) {
      return res.status(500).json({ 
        error: 'AI service configuration error. Please check API key.' 
      });
    }
    
    if (error.message.includes('quota')) {
      return res.status(429).json({ 
        error: 'AI service quota exceeded. Please try again later.' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to generate content. Please try again.' 
    });
  }
});

// Health check for AI service
router.get('/health', authenticateToken, async (req, res) => {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Google Gemini API key not configured' 
      });
    }

    res.json({ 
      status: 'ok', 
      service: 'Google Gemini AI',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'AI service health check failed' 
    });
  }
});

export default router;