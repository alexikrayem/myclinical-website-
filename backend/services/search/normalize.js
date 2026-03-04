import sanitizeHtml from 'sanitize-html';

const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const ARABIC_TATWEEL_REGEX = /\u0640/g;

export function stripHtml(input) {
  if (!input) return '';
  return sanitizeHtml(String(input), { allowedTags: [], allowedAttributes: {} });
}

export function normalizeArabic(text) {
  if (!text) return '';
  let normalized = String(text);

  normalized = normalized.replace(ARABIC_DIACRITICS_REGEX, '');
  normalized = normalized.replace(ARABIC_TATWEEL_REGEX, '');

  // Normalize common Arabic letter variants
  normalized = normalized
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه');

  return normalized;
}

export function normalizeText(input) {
  if (!input) return '';
  let text = String(input);
  text = normalizeArabic(text);
  text = text.toLowerCase();
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function normalizeQuery(input) {
  return normalizeText(input);
}

export function truncateText(input, maxLength = 20000) {
  if (!input) return '';
  const text = String(input);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength);
}
