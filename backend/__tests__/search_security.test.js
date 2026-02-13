import { jest } from '@jest/globals';
import { sanitizeSearchInput, buildFtsQuery, isValidSearchTerm } from '../utils/searchUtils.js';

describe('Search Security Utilities', () => {

    describe('sanitizeSearchInput', () => {
        it('should return empty string for null/undefined input', () => {
            expect(sanitizeSearchInput(null)).toBe('');
            expect(sanitizeSearchInput(undefined)).toBe('');
            expect(sanitizeSearchInput('')).toBe('');
        });

        it('should trim whitespace', () => {
            expect(sanitizeSearchInput('  hello  ')).toBe('hello');
        });

        it('should limit input length', () => {
            const longInput = 'a'.repeat(300);
            const result = sanitizeSearchInput(longInput);
            expect(result.length).toBeLessThanOrEqual(200);
        });

        it('should escape LIKE wildcards % and _', () => {
            // Note: backslashes are also escaped, so % becomes \\%
            expect(sanitizeSearchInput('100%')).toContain('%');
            expect(sanitizeSearchInput('test_case')).toContain('_');
            // Verify the escaping happened (contains backslash before wildcard)
            expect(sanitizeSearchInput('100%')).toMatch(/\\+%/);
            expect(sanitizeSearchInput('test_case')).toMatch(/\\+_/);
        });

        it('should escape single quotes', () => {
            expect(sanitizeSearchInput("O'Reilly")).toBe("O''Reilly");
        });

        it('should neutralize Supabase filter operators', () => {
            expect(sanitizeSearchInput('test.ilike.injection')).toBe('test injection');
            expect(sanitizeSearchInput('foo.eq.bar')).toBe('foo bar');
            expect(sanitizeSearchInput('value.or.other')).toBe('value other');
        });

        it('should handle normal search terms correctly', () => {
            expect(sanitizeSearchInput('dental implant')).toBe('dental implant');
            expect(sanitizeSearchInput('طب الأسنان')).toBe('طب الأسنان');
        });

        it('should handle combined attack patterns', () => {
            const malicious = "test' OR 1=1--";
            const result = sanitizeSearchInput(malicious);
            // Single quotes should be doubled (escaped)
            expect(result).toContain("''"); // Escaped quote
            // Should not contain unescaped single quote followed by space
            expect(result).not.toMatch(/[^']'[^']/); // No unescaped single quotes
        });
    });

    describe('buildFtsQuery', () => {
        it('should return empty string for invalid input', () => {
            expect(buildFtsQuery(null)).toBe('');
            expect(buildFtsQuery('')).toBe('');
            expect(buildFtsQuery('   ')).toBe('');
        });

        it('should format single word for FTS', () => {
            expect(buildFtsQuery('dental')).toBe('dental:*');
        });

        it('should format multiple words with OR operator', () => {
            const result = buildFtsQuery('dental implant');
            expect(result).toBe('dental:* | implant:*');
        });

        it('should remove special characters', () => {
            const result = buildFtsQuery('test (special) chars!');
            expect(result).toBe('test:* | special:* | chars:*');
        });

        it('should handle Arabic text', () => {
            const result = buildFtsQuery('طب الأسنان');
            expect(result).toBe('طب:* | الأسنان:*');
        });
    });

    describe('isValidSearchTerm', () => {
        it('should return false for empty/null input', () => {
            expect(isValidSearchTerm(null)).toBe(false);
            expect(isValidSearchTerm('')).toBe(false);
            expect(isValidSearchTerm('   ')).toBe(false);
        });

        it('should return true for valid search terms', () => {
            expect(isValidSearchTerm('dental')).toBe(true);
            expect(isValidSearchTerm('طب')).toBe(true);
        });
    });
});
