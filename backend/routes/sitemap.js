import express from 'express';
import { supabasePublic as supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { applyPublicArticleFilter } from '../utils/articleVisibility.js';

const router = express.Router();

const SITE_URL = process.env.SITE_URL || 'https://tabeeb.com';

/**
 * @route GET /sitemap.xml
 * @desc Generate XML sitemap for SEO
 */
router.get('/sitemap.xml', asyncHandler(async (req, res) => {
    // Fetch all articles
    const { data: articles, error: articlesError } = await applyPublicArticleFilter(supabase
        .from('articles')
        .select('id, slug, updated_at')
        .order('updated_at', { ascending: false }));

    if (articlesError) {
        throw new AppError('Error generating sitemap', 500, 'SITEMAP_FETCH_FAILED');
    }

    // Fetch all research papers
    const { data: research, error: researchError } = await supabase
        .from('researches')
        .select('id, updated_at')
        .order('updated_at', { ascending: false });

    if (researchError) {
        throw new AppError('Error generating sitemap', 500, 'SITEMAP_FETCH_FAILED');
    }

    // Fetch all courses
    const { data: courses, error: coursesError } = await supabase
        .from('video_courses')
        .select('id, updated_at')
        .order('updated_at', { ascending: false });

    if (coursesError) {
        throw new AppError('Error generating sitemap', 500, 'SITEMAP_FETCH_FAILED');
    }

    // Build XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const ENABLE_COURSES = process.env.ENABLE_COURSES !== 'false';
    const staticPages = [
        { loc: '/', priority: '1.0' },
        { loc: '/articles', priority: '0.9' },
        { loc: '/clinical-cases', priority: '0.9' },
        ...(ENABLE_COURSES ? [{ loc: '/courses', priority: '0.9' }] : []),
        { loc: '/research-topics', priority: '0.8' },
        { loc: '/about', priority: '0.5' },
    ];

    staticPages.forEach(page => {
        xml += '  <url>\n';
        xml += `    <loc>${SITE_URL}${page.loc}</loc>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '  </url>\n';
    });

    // Articles
    articles?.forEach(article => {
        const path = article.slug ? `/articles/${article.slug}` : `/articles/${article.id}`;
        xml += '  <url>\n';
        xml += `    <loc>${SITE_URL}${path}</loc>\n`;
        xml += `    <lastmod>${new Date(article.updated_at).toISOString().split('T')[0]}</lastmod>\n`;
        xml += '    <priority>0.8</priority>\n';
        xml += '    <changefreq>monthly</changefreq>\n';
        xml += '  </url>\n';
    });

    // Research
    research?.forEach(paper => {
        xml += '  <url>\n';
        xml += `    <loc>${SITE_URL}/research/${paper.id}</loc>\n`;
        xml += `    <lastmod>${new Date(paper.updated_at).toISOString().split('T')[0]}</lastmod>\n`;
        xml += '    <priority>0.7</priority>\n';
        xml += '    <changefreq>monthly</changefreq>\n';
        xml += '  </url>\n';
    });

    // Courses
    if (ENABLE_COURSES) {
        courses?.forEach(course => {
            xml += '  <url>\n';
            xml += `    <loc>${SITE_URL}/courses/${course.id}</loc>\n`;
            xml += `    <lastmod>${new Date(course.updated_at).toISOString().split('T')[0]}</lastmod>\n`;
            xml += '    <priority>0.8</priority>\n';
            xml += '    <changefreq>monthly</changefreq>\n';
            xml += '  </url>\n';
        });
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);
}));

/**
 * @route GET /robots.txt
 * @desc Serve robots.txt for SEO
 */
router.get('/robots.txt', (req, res) => {
    const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
    res.set('Content-Type', 'text/plain');
    res.send(robotsTxt);
});

export default router;
