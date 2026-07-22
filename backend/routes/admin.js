import express from 'express';
import authRoutes from './admin/auth.js';
import articleRoutes from './admin/articles.js';
import researchRoutes from './admin/research.js';
import courseRoutes from './admin/courses.js';
import authorRoutes from './admin/authors.js';
import categoryRoutes from './admin/categories.js';
import creditRoutes from './admin/credits.js';
import verificationRoutes from './admin/verifications.js';

const router = express.Router();

// Mount modular admin routes
router.use('/', authRoutes); // Login, Logout, Profile
router.use('/articles', articleRoutes);
router.use('/research', researchRoutes);
router.use('/courses', courseRoutes);
router.use('/authors', authorRoutes);
router.use('/categories', categoryRoutes);
router.use('/credits', creditRoutes);
router.use('/verifications', verificationRoutes);

// Fix backwards compatibility for some routes that were previously at different levels
router.use('/codes', creditRoutes); // Backward compatibility for legacy /admin/codes path
router.use('/reports', creditRoutes); // Backward compatibility for legacy /admin/reports path

export default router;

