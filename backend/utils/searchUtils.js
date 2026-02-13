/**
 * Search utility functions for sanitizing and preparing search queries.
 * Prevents query injection and unexpected behavior from special characters.
 */

/**
 * Sanitizes user input for use in Supabase ilike/filter strings.
 * Escapes characters that have special meaning in PostgreSQL LIKE patterns
 * and Supabase filter syntax.
 * 
 * @param {string} input - Raw user search input
 * @returns {string} - Sanitized input safe for use in queries
 */
export function sanitizeSearchInput(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    // Trim whitespace
    let sanitized = input.trim();

    // Limit length to prevent DoS via extremely long queries
    const MAX_SEARCH_LENGTH = 200;
    if (sanitized.length > MAX_SEARCH_LENGTH) {
        sanitized = sanitized.substring(0, MAX_SEARCH_LENGTH);
    }

    // Escape PostgreSQL LIKE special characters: % and _
    // These are wildcards in LIKE patterns
    sanitized = sanitized
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');

    // Escape characters that could break Supabase filter string syntax
    // The .or() filter uses dots and commas as separators
    // We also need to handle quotes and backslashes
    sanitized = sanitized
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/'/g, "''")     // Escape single quotes (PostgreSQL style)
        .replace(/"/g, '\\"');   // Escape double quotes

    // Remove or escape filter syntax breakers
    // Supabase uses patterns like: column.operator.value
    // We need to prevent injection of operators
    // Replace dots that could be interpreted as operator separators
    // Only if they appear in certain patterns
    sanitized = sanitized
        .replace(/\.ilike\./gi, ' ')
        .replace(/\.eq\./gi, ' ')
        .replace(/\.neq\./gi, ' ')
        .replace(/\.gt\./gi, ' ')
        .replace(/\.lt\./gi, ' ')
        .replace(/\.gte\./gi, ' ')
        .replace(/\.lte\./gi, ' ')
        .replace(/\.like\./gi, ' ')
        .replace(/\.is\./gi, ' ')
        .replace(/\.in\./gi, ' ')
        .replace(/\.cs\./gi, ' ')
        .replace(/\.cd\./gi, ' ')
        .replace(/\.or\./gi, ' ')
        .replace(/\.and\./gi, ' ');

    return sanitized;
}

/**
 * Builds a query string suitable for PostgreSQL full-text search.
 * Converts user input into a format compatible with to_tsquery.
 * 
 * @param {string} searchTerm - User search term
 * @returns {string} - Formatted query for FTS
 */
export function buildFtsQuery(searchTerm) {
    if (!searchTerm || typeof searchTerm !== 'string') {
        return '';
    }

    // Trim and limit length
    let term = searchTerm.trim().substring(0, 200);

    // Remove characters that are problematic for tsquery
    // Keep alphanumeric, Arabic characters, and spaces
    term = term.replace(/[^\p{L}\p{N}\s]/gu, ' ');

    // Split into words and join with '&' for AND search
    // or '|' for OR search (we'll use OR for broader results)
    const words = term.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) {
        return '';
    }

    // Add :* suffix for prefix matching (partial word search)
    return words.map(w => `${w}:*`).join(' | ');
}

/**
 * Validates that a search term is not empty after sanitization.
 * 
 * @param {string} input - Raw search input
 * @returns {boolean} - True if valid search term
 */
export function isValidSearchTerm(input) {
    const sanitized = sanitizeSearchInput(input);
    return sanitized.length > 0;
}
