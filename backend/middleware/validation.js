
import { z } from 'zod';

// Generic middleware to validate request against a Zod schema
export const validate = (schema) => async (req, res, next) => {
  try {
    const result = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Assign validated data back to request
    // This strips unknown keys if the schema is 'strict', or keeps them if not
    // Usually safer to assume req.body is now trusted
    // We can merge back to be safe, or just trust validation passed

    return next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'Validation Error', details: errors });
    }
    return res.status(400).json({ error: 'Invalid Input' });
  }
};

// Common Schemas
export const schemas = {
  // Auth Schemas
  register: z.object({
    body: z.object({
      phone_number: z.string().min(10, 'رقم الهاتف يجب أن يكون 10 أرقام على الأقل'),
      password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
      display_name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').optional(),
    }),
  }),

  login: z.object({
    body: z.object({
      phone_number: z.string().min(1, 'رقم الهاتف مطلوب'),
      password: z.string().min(1, 'كلمة المرور مطلوبة'),
    }),
  }),

  // Example for credit usage
  consumeCredits: z.object({
    body: z.object({
      minutes: z.number().int().positive().optional(),
      course_id: z.string().uuid().optional(),
      article_id: z.string().uuid().optional(),
    }).refine(data => data.course_id || data.article_id, {
      message: "Either course_id or article_id is required"
    }),
  }),

  // Admin Article Schema
  article: z.object({
    body: z.object({
      title: z.string().min(5, 'Title must be at least 5 chars').max(200),
      excerpt: z.string().min(10, 'Excerpt must be at least 10 chars').max(500),
      author: z.string().min(1, 'Author is required'),
      tags: z.string().refine(val => {
        try { JSON.parse(val); return true; } catch (e) { return false; }
      }, 'Tags must be a valid JSON array'),
      is_featured: z.string().optional(), // 'true' or 'false'
      cover_image_url: z.string().optional(),
      content: z.string().optional(), // HTML content
      credits_required: z.string().optional().default('0'),
      article_type: z.string().optional().default('article'),
    }),
  }),

  // Admin Research Schema
  research: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required'),
      abstract: z.string().min(1, 'Abstract is required'),
      authors: z.string().refine(val => {
        try { JSON.parse(val); return true; } catch (e) { return false; }
      }, 'Authors must be a valid JSON array'),
      journal: z.string().min(1, 'Journal is required'),
      publication_date: z.string().optional(),
    }),
  })
};

export const validateArticle = validate(schemas.article);
export const validateResearch = validate(schemas.research);