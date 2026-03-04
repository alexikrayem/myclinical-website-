
import { jest } from '@jest/globals';
import { sanitizeContent, sanitizeFileName } from '../middleware/inputSanitizer.js';
import { validatePasswordStrength } from '../config/security.js';

describe('Input Sanitization Tests', () => {
    describe('sanitizeContent', () => {
        it('should strip script tags', () => {
            const result = sanitizeContent('<p>Hello</p><script>alert("xss")</script>');
            expect(result).toBe('<p>Hello</p>');
        });

        it('should strip event handlers', () => {
            const result = sanitizeContent('<img src="x" onerror="alert(1)">');
            expect(result).not.toContain('onerror');
        });

        it('should preserve safe HTML tags', () => {
            const input = '<h1>Title</h1><p>Text <strong>bold</strong></p>';
            expect(sanitizeContent(input)).toBe(input);
        });

        it('should strip iframe tags', () => {
            const result = sanitizeContent('<p>text</p><iframe src="evil.com"></iframe>');
            expect(result).toBe('<p>text</p>');
        });

        it('should handle null and undefined gracefully', () => {
            expect(sanitizeContent(null)).toBe(null);
            expect(sanitizeContent(undefined)).toBe(undefined);
            expect(sanitizeContent('')).toBe('');
        });

        it('should allow safe link attributes', () => {
            const input = '<a href="https://example.com" target="_blank" rel="noopener">link</a>';
            const result = sanitizeContent(input);
            expect(result).toContain('href="https://example.com"');
        });

        it('should strip javascript: protocol in links', () => {
            const input = '<a href="javascript:alert(1)">click</a>';
            const result = sanitizeContent(input);
            expect(result).not.toContain('javascript:');
        });
    });

    describe('sanitizeFileName', () => {
        it('should remove path traversal sequences', () => {
            expect(sanitizeFileName('../../etc/passwd')).not.toContain('..');
        });

        it('should remove special characters but keep Arabic chars', () => {
            const result = sanitizeFileName('مقال-test_file.pdf');
            expect(result).toMatch(/^[a-zA-Z0-9\u0600-\u06FF._-]+$/);
        });

        it('should truncate filenames longer than 255 chars', () => {
            const longName = 'a'.repeat(300) + '.pdf';
            expect(sanitizeFileName(longName).length).toBeLessThanOrEqual(255);
        });

        it('should preserve file extension when truncating', () => {
            const longName = 'a'.repeat(300) + '.pdf';
            expect(sanitizeFileName(longName)).toMatch(/\.pdf$/);
        });
    });

    describe('validatePasswordStrength', () => {
        it('should pass for a strong password', () => {
            const result = validatePasswordStrength('MyP@ssw0rd!');
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should fail for short password', () => {
            const result = validatePasswordStrength('Ab1!');
            expect(result.valid).toBe(false);
            expect(result.errors.join(' ')).toMatch(/8 characters/);
        });

        it('should fail for password without uppercase', () => {
            const result = validatePasswordStrength('myp@ssw0rd!');
            expect(result.valid).toBe(false);
            expect(result.errors.join(' ')).toMatch(/uppercase/);
        });

        it('should fail for password without number', () => {
            const result = validatePasswordStrength('MyP@ssword!');
            expect(result.valid).toBe(false);
            expect(result.errors.join(' ')).toMatch(/number/);
        });

        it('should fail for password without special char', () => {
            const result = validatePasswordStrength('MyPassw0rd');
            expect(result.valid).toBe(false);
            expect(result.errors.join(' ')).toMatch(/special character/);
        });
    });
});
