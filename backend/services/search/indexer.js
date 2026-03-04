import { ensureMeiliIndexes, getMeiliClient, isMeiliEnabled } from './meiliClient.js';
import { normalizeText, stripHtml, truncateText } from './normalize.js';

const CONTENT_LIMIT = 20000;
const EXCERPT_LIMIT = 2000;

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [String(value)];
}

function normalizeArrayValues(values) {
  return normalizeArray(values)
    .map(item => normalizeText(item))
    .filter(Boolean);
}

function safeString(value) {
  return value ? String(value) : '';
}

export function prepareArticleDoc(article) {
  const contentPlain = stripHtml(article?.content || '');
  const excerptPlain = stripHtml(article?.excerpt || '');
  const tags = normalizeArray(article.tags);
  return {
    id: article.id,
    title: safeString(article.title),
    title_normalized: normalizeText(article.title),
    excerpt: truncateText(excerptPlain, EXCERPT_LIMIT),
    excerpt_normalized: normalizeText(excerptPlain),
    content_normalized: normalizeText(truncateText(contentPlain, CONTENT_LIMIT)),
    author: safeString(article.author),
    author_normalized: normalizeText(article.author),
    tags,
    tags_normalized: normalizeArrayValues(tags),
    article_type: safeString(article.article_type || 'article'),
    is_featured: !!article.is_featured,
    publication_date: article.publication_date || article.created_at || null
  };
}

export function prepareResearchDoc(research) {
  const authorsArray = normalizeArray(research.authors);
  const abstractPlain = stripHtml(research?.abstract || '');
  return {
    id: research.id,
    title: safeString(research.title),
    title_normalized: normalizeText(research.title),
    abstract: truncateText(abstractPlain, EXCERPT_LIMIT),
    abstract_normalized: normalizeText(abstractPlain),
    journal: safeString(research.journal),
    journal_normalized: normalizeText(research.journal),
    authors: authorsArray,
    authors_normalized: normalizeText(authorsArray.join(' ')),
    publication_date: research.publication_date || research.created_at || null
  };
}

export function prepareCourseDoc(course) {
  const descriptionPlain = stripHtml(course?.description || '');
  const ratingValue = course?.rating;
  const ratingNumber = ratingValue !== undefined && ratingValue !== null && !Number.isNaN(Number(ratingValue))
    ? Number(ratingValue)
    : null;
  const categories = normalizeArray(course.categories);
  return {
    id: course.id,
    title: safeString(course.title),
    title_normalized: normalizeText(course.title),
    description: truncateText(descriptionPlain, CONTENT_LIMIT),
    description_normalized: normalizeText(descriptionPlain),
    author: safeString(course.author),
    author_normalized: normalizeText(course.author),
    categories,
    categories_normalized: normalizeArrayValues(categories),
    is_featured: !!course.is_featured,
    level: safeString(course.level),
    rating: ratingNumber,
    publication_date: course.publication_date || course.created_at || null
  };
}

async function addDocuments(indexName, docs) {
  if (!isMeiliEnabled()) return null;
  if (!docs.length) return null;
  const client = getMeiliClient();
  await ensureMeiliIndexes();
  const task = await client.index(indexName).addDocuments(docs);
  await client.waitForTask(task.taskUid);
  return task;
}

async function deleteDocument(indexName, id) {
  if (!isMeiliEnabled()) return null;
  const client = getMeiliClient();
  await ensureMeiliIndexes();
  const task = await client.index(indexName).deleteDocument(id);
  await client.waitForTask(task.taskUid);
  return task;
}

export async function indexArticle(article) {
  if (!article) return null;
  return addDocuments('articles', [prepareArticleDoc(article)]);
}

export async function indexResearch(research) {
  if (!research) return null;
  return addDocuments('researches', [prepareResearchDoc(research)]);
}

export async function indexCourse(course) {
  if (!course) return null;
  return addDocuments('courses', [prepareCourseDoc(course)]);
}

export async function indexArticlesBatch(articles) {
  return addDocuments('articles', articles.map(prepareArticleDoc));
}

export async function indexResearchBatch(researches) {
  return addDocuments('researches', researches.map(prepareResearchDoc));
}

export async function indexCoursesBatch(courses) {
  return addDocuments('courses', courses.map(prepareCourseDoc));
}

export async function removeArticle(id) {
  return deleteDocument('articles', id);
}

export async function removeResearch(id) {
  return deleteDocument('researches', id);
}

export async function removeCourse(id) {
  return deleteDocument('courses', id);
}
