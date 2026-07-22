/**
 * Standard fields for database queries to prevent grabbing arbitrary entire rows
 * (avoiding SELECT * as an anti-pattern).
 */

export const ARTICLE_LIST_SELECT = 'id, title, slug, excerpt, cover_image, publication_date, author, tags, article_type, is_featured, credits_required';
export const ARTICLE_DETAIL_SELECT = `${ARTICLE_LIST_SELECT}, content`;

export const RESEARCH_LIST_SELECT = 'id, title, journal, abstract, publication_date, authors, file_url, credits_required';

export const COURSE_LIST_SELECT = 'id, title, cover_image, author, categories, is_featured, credits_required, billing_model, minute_cost, playback_provider, duration, level, rating';
export const COURSE_DETAIL_SELECT = `${COURSE_LIST_SELECT}, description, preview_source, preview_seconds, attention_required`;

export const TRANSACTION_SELECT = 'id, transaction_type, amount, credit_type, description, transaction_date, balance_before, balance_after';
export const ADMIN_SELECT = 'id, email, role, created_at';
export const QUIZ_SELECT = 'id, course_id, questions, created_at';
