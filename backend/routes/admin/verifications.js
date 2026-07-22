import express from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errors.js';
import { supabaseAdmin as supabase } from '../../config/supabase.js';
import { authenticateToken } from '../../middleware/auth.js';
import logger from '../../config/logger.js';

const router = express.Router();

/**
 * GET /api/admin/verifications
 * Get list of all pending doctor verifications
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { data: pendingDoctors, error } = await supabase
        .from('users')
        .select('id, phone_number, display_name, role, verification_status, specialization, bio, education, experience_years, clinic_address, email, website, created_at')
        .eq('role', 'doctor')
        .eq('verification_status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        logger.error('Error fetching verifications:', error);
        throw new AppError('Failed to fetch verification requests', 500, 'ADMIN_DB_ERROR');
    }

    res.json(pendingDoctors || []);
}));

/**
 * GET /api/admin/verifications/:id/card
 * Generate a secure time-limited signed URL for viewing the syndicate card
 */
router.get('/:id/card', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Fetch card URL path from DB
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('syndicate_card_url')
        .eq('id', id)
        .single();

    if (fetchError || !user || !user.syndicate_card_url) {
        return res.status(404).json({
            error: 'صورة الهوية المهنية غير موجودة لهذا المستخدم',
            code: 'CARD_NOT_FOUND'
        });
    }

    // Generate signed URL (expires in 15 minutes / 900 seconds)
    const { data: signedUrlData, error: signError } = await supabase.storage
        .from('syndicate-cards')
        .createSignedUrl(user.syndicate_card_url, 900);

    if (signError || !signedUrlData) {
        logger.error('Error generating signed URL for card:', signError);
        throw new AppError('Failed to retrieve card image', 500, 'STORAGE_ERROR');
    }

    res.json({
        signedUrl: signedUrlData.signedUrl
    });
}));

/**
 * POST /api/admin/verifications/:id/approve
 * Approve the doctor verification request and create author profile
 */
router.post('/:id/approve', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 1. Fetch user profile
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError || !user) {
        return res.status(404).json({
            error: 'المستخدم غير موجود',
            code: 'USER_NOT_FOUND'
        });
    }

    if (user.verification_status !== 'pending') {
        return res.status(400).json({
            error: 'هذا الطلب تم معالجته مسبقاً',
            code: 'REQUEST_ALREADY_PROCESSED'
        });
    }

    // 2. Check if author with this user_id or display name already exists
    const { data: existingAuthorByUserId } = await supabase
        .from('authors')
        .select('id')
        .eq('user_id', id)
        .maybeSingle();

    const { data: existingAuthorByName } = await supabase
        .from('authors')
        .select('id')
        .ilike('name', user.display_name.trim())
        .maybeSingle();

    if (existingAuthorByUserId) {
        return res.status(409).json({
            error: 'هذا الحساب مرتبط بالفعل بملف مؤلف سابق',
            code: 'AUTHOR_USER_EXISTS'
        });
    }

    if (existingAuthorByName) {
        return res.status(409).json({
            error: `الاسم المهني "${user.display_name}" مستخدم بالفعل من قبل كاتب آخر في المنصة. يرجى الطلب من الطبيب تعديل اسمه قبل الموافقة`,
            code: 'AUTHOR_NAME_EXISTS'
        });
    }

    // 3. Update verification status
    const { error: updateError } = await supabase
        .from('users')
        .update({
            verification_status: 'approved',
            is_active: true,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (updateError) {
        logger.error('Error updating user status:', updateError);
        throw new AppError('Failed to approve doctor', 500, 'ADMIN_DB_ERROR');
    }

    // 4. Create Author entry linking to user_id
    const { error: authorError } = await supabase
        .from('authors')
        .insert({
            user_id: user.id,
            name: user.display_name.trim(),
            bio: user.bio || 'طبيب أسنان ممارس ومؤلف',
            specialization: user.specialization || 'طب الأسنان العام',
            experience_years: user.experience_years || 1,
            education: user.education || 'بكالوريوس طب الأسنان',
            location: user.clinic_address || 'المملكة العربية السعودية',
            email: user.email || null,
            website: user.website || null,
            is_active: true,
            image: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2' // Default premium avatar
        });

    if (authorError) {
        logger.error('Error creating author for approved doctor:', authorError);
        
        // Rollback verification status to pending if author creation fails
        await supabase
            .from('users')
            .update({
                verification_status: 'pending',
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        throw new AppError('Failed to create author profile', 500, 'ADMIN_DB_ERROR');
    }

    res.json({
        success: true,
        message: 'تم قبول طلب التحقق وإنشاء الملف المهني للطبيب بنجاح'
    });
}));

/**
 * POST /api/admin/verifications/:id/reject
 * Reject the doctor verification request
 */
router.post('/:id/reject', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
        return res.status(400).json({
            error: 'سبب الرفض مطلوب لمساعدة الطبيب على تعديل بياناته',
            code: 'REJECTION_REASON_REQUIRED'
        });
    }

    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('verification_status')
        .eq('id', id)
        .single();

    if (fetchError || !user) {
        return res.status(404).json({
            error: 'المستخدم غير موجود',
            code: 'USER_NOT_FOUND'
        });
    }

    if (user.verification_status !== 'pending') {
        return res.status(400).json({
            error: 'هذا الطلب تم معالجته مسبقاً',
            code: 'REQUEST_ALREADY_PROCESSED'
        });
    }

    const { error: rejectError } = await supabase
        .from('users')
        .update({
            verification_status: 'rejected',
            rejection_reason: rejection_reason.trim(),
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (rejectError) {
        logger.error('Error rejecting verification:', rejectError);
        throw new AppError('Failed to reject request', 500, 'ADMIN_DB_ERROR');
    }

    res.json({
        success: true,
        message: 'تم رفض طلب التحقق وحفظ السبب'
    });
}));

export default router;
