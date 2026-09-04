
import { z } from 'zod';
import { cleanPhoneNumber, isValidPhoneNumber, normalizePhoneNumber } from '../utils/phone.js';

// Generic middleware to validate request against a Zod schema
export const validate = (schema) => async (req, res, next) => {

  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const result = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    req.body = result.body;
    req.query = result.query;
    req.params = result.params;

    return next();

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      const message = errors[0]?.message || 'Validation Error';
      return res.status(400).json({ error: 'Validation Error', message, details: errors });
    }
    return res.status(400).json({ error: 'Invalid Input' });
  }
};

// Common Schemas
const phoneSchema = z.string()
  .trim()
  .min(1, 'رقم الهاتف مطلوب')
  .transform((val) => cleanPhoneNumber(val))
  .refine((val) => isValidPhoneNumber(val), 'رقم الهاتف غير صحيح')
  .transform((val) => normalizePhoneNumber(val));

const displayNameSchema = z.preprocess(
  (val) => {
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').optional()
);

const optionalTrimmedString = z.preprocess(
  (val) => {
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().optional()
);

const toIntFromQuery = (val) => {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  return Number.isFinite(num) ? num : val;
};

const queryInt = (min, max, defaultValue) => z.preprocess(
  toIntFromQuery,
  z.number().int().min(min).max(max).default(defaultValue)
);

const toIntFromBody = (val) => {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  return Number.isFinite(num) ? num : val;
};

const bodyInt = (min, max) => z.preprocess(
  toIntFromBody,
  z.number().int().min(min).max(max)
);

export const schemas = {
  // ── Social Auth Schemas ──────────────────────────────────────────────────

  // POST /api/auth/social/callback
  socialCallback: z.object({
    body: z.object({
      provider: z.enum(['facebook', 'instagram'], {
        errorMap: () => ({ message: 'مزود تسجيل الدخول يجب أن يكون facebook أو instagram' })
      }),
      code: z.string().trim().min(1, 'رمز المصادقة مطلوب').max(4096),
      specialty: z.preprocess(
        (val) => {
          if (typeof val !== 'string') return val;
          const trimmed = val.trim();
          return trimmed === '' ? undefined : trimmed;
        },
        z.string().max(100, 'التخصص لا يتجاوز 100 حرف').optional()
      ),
    }),
  }),

  // POST /api/auth/verify (multipart — non-file fields only)
  verificationSubmission: z.object({
    body: z.object({
      full_name: z.string().trim().min(2, 'الاسم الكامل مطلوب (حرفان على الأقل)').max(150),
      specialty: z.string().trim().min(1, 'التخصص مطلوب').max(100),
      notes: z.preprocess(
        (val) => {
          if (typeof val !== 'string') return val;
          const trimmed = val.trim();
          return trimmed === '' ? undefined : trimmed;
        },
        z.string().max(1000).optional()
      ),
    }),
  }),

  // Profile update — display_name and specialty are both optional;
  // but if provided they must be non-empty within sensible length bounds.
  updateProfile: z.object({
    body: z.object({
      display_name: z.preprocess(
        (val) => {
          if (typeof val !== 'string') return val;
          const trimmed = val.trim();
          return trimmed === '' ? undefined : trimmed;
        },
        z.string()
          .min(2, 'الاسم يجب أن يكون حرفين على الأقل')
          .max(100, 'الاسم لا يمكن أن يتجاوز 100 حرف')
          .optional()
      ),
      specialty: z.preprocess(
        (val) => {
          if (typeof val !== 'string') return val;
          const trimmed = val.trim();
          return trimmed === '' ? undefined : trimmed;
        },
        z.string()
          .min(1, 'التخصص لا يمكن أن يكون فارغاً')
          .max(100, 'التخصص لا يتجاوز 100 حرف')
          .optional()
      ),
    }),
  }),

  redeem: z.object({
    body: z.object({
      code: z.string()
        .trim()
        .toUpperCase()
        .max(50, 'الكود لا يمكن أن يتجاوز 50 حرفاً')
        .regex(/^[A-Z0-9]+(-[A-Z0-9]{4}){3,}$/, 'صيغة الكود غير صحيحة')
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
  }),

  researchList: z.object({
    query: z.object({
      journal: optionalTrimmedString,
      search: optionalTrimmedString,
      page: queryInt(1, 1000, 1),
      limit: queryInt(1, 50, 12),
    })
  }),

  // Credits + Courses
  creditsConsumeVideo: z.object({
    body: z.object({
      minutes: bodyInt(1, 100000),
      course_id: z.string().uuid()
    })
  }),

  creditsConsumeArticle: z.object({
    body: z.object({
      article_id: z.string().uuid()
    })
  }),

  creditsConsumeResearch: z.object({
    body: z.object({
      research_id: z.string().uuid()
    })
  }),

  creditsTransactions: z.object({
    query: z.object({
      page: queryInt(1, 1000, 1),
      limit: queryInt(1, 100, 10),
      type: z.enum(['redeem', 'usage', 'refund', 'adjustment', 'earn']).optional()
    })
  }),

  // Fix #12 — separate schemas per route so each validates only its own param
  creditsCheckArticleAccess: z.object({
    params: z.object({
      articleId: z.string().uuid('articleId must be a valid UUID')
    })
  }),

  creditsCheckResearchAccess: z.object({
    params: z.object({
      researchId: z.string().uuid('researchId must be a valid UUID')
    })
  }),

  coursePlayback: z.object({
    params: z.object({
      id: z.string().uuid()
    })
  }),

  coursePlaybackRefresh: z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ session_id: z.string().uuid() })
  }),

  coursesList: z.object({
    query: z.object({
      category: optionalTrimmedString,
      search: optionalTrimmedString,
      featured: optionalTrimmedString,
      page: queryInt(1, 1000, 1),
      limit: queryInt(1, 100, 12),
    })
  }),

  courseById: z.object({
    params: z.object({
      id: z.string().uuid()
    })
  }),

  courseHeartbeat: z.object({
    params: z.object({
      id: z.string().uuid()
    }),
    body: z.object({
      session_id: z.string().uuid(),
      seconds_delta: bodyInt(1, 36000),
      idempotency_key: optionalTrimmedString
    })
  }),

  courseHlsManifest: z.object({
    params: z.object({
      id: z.string().uuid()
    }),
    query: z.object({
      session_id: z.string().uuid(),
      playlist: optionalTrimmedString
    })
  }),

  courseHlsSegment: z.object({
    params: z.object({ id: z.string().uuid() }),
    query: z.object({
      session_id: z.string().uuid(),
      path: z.string().trim().min(1).max(1024)
    })
  }),

  courseAccess: z.object({
    params: z.object({
      id: z.string().uuid()
    }),
    body: z.object({
      idempotency_key: optionalTrimmedString
    }).optional()
  }),

  courseAttentionCheck: z.object({
    params: z.object({
      id: z.string().uuid()
    }),
    query: z.object({
      session_id: z.string().uuid(),
      current_seconds: z.preprocess(toIntFromQuery, z.number().min(0))
    })
  }),

  courseAttentionVerify: z.object({
    params: z.object({
      id: z.string().uuid()
    }),
    body: z.object({
      session_id: z.string().uuid(),
      challenge_id: z.string().uuid(),
      answer: optionalTrimmedString,
      expired: z.boolean().optional()
    })
  }),

  courseGenerateQuiz: z.object({
    params: z.object({
      id: z.string().uuid()
    })
  }),

  courseQuiz: z.object({
    params: z.object({
      id: z.string().uuid()
    })
  }),

  courseQuizSubmit: z.object({
    params: z.object({
      id: z.string().uuid()
    }),
    body: z.object({
      quizId: z.string().uuid(),
      answers: z.array(z.number().int().min(0).max(3)).min(1)
    })
  }),
};

export const validateArticle = validate(schemas.article);
export const validateResearch = validate(schemas.research);
export const validateRedeem = validate(schemas.redeem);
