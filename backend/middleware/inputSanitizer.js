import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import sanitizeHtml from 'sanitize-html';

// Sanitize data to prevent NoSQL injection
export const sanitizeData = mongoSanitize({
	replaceWith: '_',
	onSanitize: ({ req, key }) => {
		console.warn(`Potential NoSQL injection attempt detected in ${key}`);
	},
});

// Prevent XSS attacks by cleaning user input
export const preventXSS = xss();

// Prevent HTTP Parameter Pollution
export const preventHPP = hpp({
	whitelist: [
		'tag',
		'search',
		'limit',
		'page',
		'sort',
		'category',
		'is_featured',
		'publication_date'
	],
});

// Custom input validation middleware
export const validateInput = (req, res, next) => {
	// Check for null bytes in strings
	const checkNullBytes = (obj) => {
		for (const key in obj) {
			if (typeof obj[key] === 'string') {
				if (obj[key].indexOf('\0') !== -1) {
					return false;
				}
			} else if (typeof obj[key] === 'object' && obj[key] !== null) {
				if (!checkNullBytes(obj[key])) {
					return false;
				}
			}
		}
		return true;
	};

	if (!checkNullBytes(req.body) || !checkNullBytes(req.query) || !checkNullBytes(req.params)) {
		return res.status(400).json({ error: 'Invalid input: null bytes detected' });
	}

	next();
};

// Sanitize file names
export const sanitizeFileName = (filename) => {
	// Remove any path traversal attempts
	let sanitized = filename.replace(/\.\./g, '');

	// Remove special characters except alphanumeric, dash, underscore, and dot
	sanitized = sanitized.replace(/[^a-zA-Z0-9\u0600-\u06FF._-]/g, '_');

	// Ensure filename is not too long
	if (sanitized.length > 255) {
		const ext = sanitized.substring(sanitized.lastIndexOf('.'));
		sanitized = sanitized.substring(0, 255 - ext.length) + ext;
	}

	return sanitized;
};

// Content sanitization for rich text fields
export const sanitizeContent = (content) => {
	if (!content || typeof content !== 'string') return content;

	return sanitizeHtml(content, {
		allowedTags: [
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
			'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
			'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'img'
		],
		allowedAttributes: {
			'a': ['href', 'name', 'target', 'rel'],
			'img': ['src', 'alt', 'title', 'width', 'height'],
			'*': ['class', 'style', 'dir', 'lang']
		},
		selfClosing: ['img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta'],
		allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel'],
		allowedSchemesByTag: {},
		allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
		allowProtocolRelative: true,
		enforceHtmlBoundary: false
	});
};