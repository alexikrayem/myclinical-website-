import { jest } from '@jest/globals';
import { sanitizeContent } from '../middleware/inputSanitizer.js';

describe('XSS Sanitization Tests', () => {

    it('should strip script tags', () => {
        const input = '<p>Hello</p><script>alert("xss")</script>';
        const output = sanitizeContent(input);
        expect(output).toBe('<p>Hello</p>');
    });

    it('should strip onerror attributes', () => {
        const input = '<img src="x" onerror="alert(1)">';
        const output = sanitizeContent(input);
        // sanitize-html might encode the &lt;img&gt; if src is invalid or remove the attribute
        // Let's check that onerror is gone.
        expect(output).not.toContain('onerror');
        expect(output).toContain('<img src="x" />');
    });

    it('should preserve allowed tags', () => {
        const input = '<h1>Title</h1><p>Paragraph <strong>bold</strong></p>';
        const output = sanitizeContent(input);
        expect(output).toBe(input);
    });

    it('should remove disallowed tags (like frames)', () => {
        const input = '<p>Text</p><iframe></iframe>';
        const output = sanitizeContent(input);
        expect(output).toBe('<p>Text</p>');
    });

    it('should handle null/undefined input', () => {
        expect(sanitizeContent(null)).toBe(null);
        expect(sanitizeContent(undefined)).toBe(undefined);
    });
});
