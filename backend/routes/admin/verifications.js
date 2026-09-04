/**
 * admin/verifications.js
 *
 * Admin endpoints for reviewing professional verification submissions.
 * All data comes from the `verification_submissions` table (decoupled from
 * user registration) rather than directly from the `users` table.
 *
 * Endpoints:
 *   GET  /api/admin/verifications                       — list pending submissions
 *   GET  /api/admin/verifications/:id/documents         — get signed URLs for all docs
 *   POST /api/admin/verifications/:id/approve           — approve + create author profile
 *   POST /api/admin/verifications/:id/reject            — reject with reason
 */

import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errors.js';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { authenticateToken } from '../../middleware/auth.js';
import logger from '../../config/logger.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/verifications
// Returns all pending verification submissions with joined user data.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { data: submissions, error } = await supabase
        .from('verification_submissions')
        .select(`
            id,
            full_name,
            specialty,
            notes,
            status,
            created_at,
            users (
                id,
                display_name,
                social_provider,
                social_username,
                social_profile_url,
                social_avatar_url,
                specialty,
                is_verified,
                verification_status
            )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        logger.error('Error fetching verification submissions:', error);
        throw new AppError('Failed to fetch verification requests', 500, 'ADMIN_DB_ERROR');
    }

    res.json(submissions || []);
}));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/verifications/:id/documents
// Returns signed URLs (15 min expiry) for all three verification documents.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/documents', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: submission, error: fetchError } = await supabase
        .from('verification_submissions')
        .select('personal_id_url, medical_id_url, practice_license_url')
        .eq('id', id)
        .single();

    if (fetchError || !submission) {
        return res.status(404).json({
            error: 'طلب التوثيق غير موجود',
            code: 'SUBMISSION_NOT_FOUND',
        });
    }

    const BUCKET = 'verification-documents';
    const TTL = 900; // 15 minutes

    const [personalIdResult, medicalIdResult, practiceResult] = await Promise.all([
        supabase.storage.from(BUCKET).createSignedUrl(submission.personal_id_url, TTL),
        supabase.storage.from(BUCKET).createSignedUrl(submission.medical_id_url, TTL),
        supabase.storage.from(BUCKET).createSignedUrl(submission.practice_license_url, TTL),
    ]);

    if (personalIdResult.error || medicalIdResult.error || practiceResult.error) {
        logger.error('Error generating verification document signed URLs:', {
            personalId: personalIdResult.error,
            medicalId: medicalIdResult.error,
            practice: practiceResult.error,
        });
        throw new AppError('Failed to generate document access URLs', 500, 'STORAGE_ERROR');
    }

    res.json({
        personal_id_url: personalIdResult.data.signedUrl,
        medical_id_url: medicalIdResult.data.signedUrl,
        practice_license_url: practiceResult.data.signedUrl,
    });
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/verifications/:id/approve
// Approves a submission. Trigger sequence:
//  1. Verify submission exists and is still pending
//  2. Check for duplicate author entries
//  3. Update submission status → 'approved'
//  4. Set users.is_verified = true + verification_status = 'approved'
//  5. Create or link an author profile for the user
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 1. Fetch submission with user data
    const { data: submission, error: fetchError } = await supabase
        .from('verification_submissions')
        .select('*, users(*)')
        .eq('id', id)
        .single();

    if (fetchError || !submission) {
        return res.status(404).json({
            error: 'طلب التوثيق غير موجود',
            code: 'SUBMISSION_NOT_FOUND',
        });
    }

    if (submission.status !== 'pending') {
        return res.status(400).json({
            error: 'هذا الطلب تم معالجته مسبقاً',
            code: 'REQUEST_ALREADY_PROCESSED',
        });
    }

    const user = submission.users;
    if (!user) {
        return res.status(404).json({
            error: 'المستخدم المرتبط بالطلب غير موجود',
            code: 'USER_NOT_FOUND',
        });
    }

    // 2. Check for duplicate author entries
    const { data: existingAuthorByUserId } = await supabase
        .from('authors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (existingAuthorByUserId) {
        // Author already exists — just approve the submission and set verified flag
        await supabase
            .from('verification_submissions')
            .update({ status: 'approved', reviewed_at: new Date().toISOString() })
            .eq('id', id);

        await supabase
            .from('users')
            .update({ is_verified: true, verification_status: 'approved', updated_at: new Date().toISOString() })
            .eq('id', user.id);

        return res.json({
            success: true,
            message: 'تم قبول طلب التوثيق. المستخدم لديه ملف كاتب بالفعل',
        });
    }

    const authorName = (submission.full_name || user.display_name || 'كاتب').trim();

    const { data: existingAuthorByName } = await supabase
        .from('authors')
        .select('id')
        .ilike('name', authorName)
        .maybeSingle();

    if (existingAuthorByName) {
        return res.status(409).json({
            error: `الاسم المهني "${authorName}" مستخدم بالفعل من قبل كاتب آخر. يرجى مراجعة البيانات`,
            code: 'AUTHOR_NAME_EXISTS',
        });
    }

    // 3. Update submission status
    const { error: submissionUpdateError } = await supabase
        .from('verification_submissions')
        .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (submissionUpdateError) {
        logger.error('Error updating submission status:', submissionUpdateError);
        throw new AppError('Failed to update submission status', 500, 'ADMIN_DB_ERROR');
    }

    // 4. Set user as verified
    const { error: userUpdateError } = await supabase
        .from('users')
        .update({
            is_verified: true,
            verification_status: 'approved',
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

    if (userUpdateError) {
        logger.error('Error setting user as verified:', userUpdateError);
        // Rollback submission
        await supabase
            .from('verification_submissions')
            .update({ status: 'pending' })
            .eq('id', id);
        throw new AppError('Failed to approve user', 500, 'ADMIN_DB_ERROR');
    }

    // 5. Create author profile
    const DEFAULT_AVATAR = 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2';

    const { error: authorError } = await supabase
        .from('authors')
        .insert({
            user_id: user.id,
            name: authorName,
            bio: `طبيب متخصص في ${submission.specialty || 'الطب العام'}`,
            specialization: submission.specialty || 'طب عام',
            experience_years: 1,
            education: 'غير محدد',
            location: 'غير محدد',
            email: null,
            website: null,
            is_active: true,
            image: user.social_avatar_url || DEFAULT_AVATAR,
            avatar_url: user.social_avatar_url || DEFAULT_AVATAR,
        });

    if (authorError) {
        logger.error('Error creating author profile:', authorError);
        // Rollback both updates
        await supabase
            .from('users')
            .update({ is_verified: false, verification_status: 'pending', updated_at: new Date().toISOString() })
            .eq('id', user.id);
        await supabase
            .from('verification_submissions')
            .update({ status: 'pending' })
            .eq('id', id);
        throw new AppError('Failed to create author profile', 500, 'ADMIN_DB_ERROR');
    }

    res.json({
        success: true,
        message: 'تم قبول طلب التوثيق وإنشاء الملف المهني بنجاح',
    });
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/verifications/:id/reject
// Body: { rejection_reason: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/reject', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
        return res.status(400).json({
            error: 'سبب الرفض مطلوب لمساعدة المستخدم على تصحيح البيانات',
            code: 'REJECTION_REASON_REQUIRED',
        });
    }

    const { data: submission, error: fetchError } = await supabase
        .from('verification_submissions')
        .select('id, status, user_id')
        .eq('id', id)
        .single();

    if (fetchError || !submission) {
        return res.status(404).json({
            error: 'طلب التوثيق غير موجود',
            code: 'SUBMISSION_NOT_FOUND',
        });
    }

    if (submission.status !== 'pending') {
        return res.status(400).json({
            error: 'هذا الطلب تم معالجته مسبقاً',
            code: 'REQUEST_ALREADY_PROCESSED',
        });
    }

    const { error: rejectError } = await supabase
        .from('verification_submissions')
        .update({
            status: 'rejected',
            rejection_reason: rejection_reason.trim(),
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (rejectError) {
        logger.error('Error rejecting submission:', rejectError);
        throw new AppError('Failed to reject request', 500, 'ADMIN_DB_ERROR');
    }

    // Update user's verification_status to reflect the rejection
    await supabase
        .from('users')
        .update({ verification_status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', submission.user_id);

    res.json({
        success: true,
        message: 'تم رفض طلب التوثيق وحفظ السبب',
    });
}));

export default router;
