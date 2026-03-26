import express from 'express';
import dotenv from 'dotenv';
import { supabaseAdmin as supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';

dotenv.config();

const router = express.Router();

/**
 * @swagger
 * /research/{id}/pdf:
 *   get:
 *     summary: Get secure PDF viewing URL (authenticated users only)
 *     tags: [Research]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Research paper ID
 *     responses:
 *       200:
 *         description: Signed URL for PDF viewing
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Research not found
 */
import { authenticateUser } from '../middleware/userAuth.js'; // Added import

// ... imports

// ... existing code ...

router.get('/:id/pdf', authenticateUser, asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        // User is guaranteed to be authenticated and existing by middleware
        const userId = req.user.id;

        // 2. Get research paper details
        const { data: research, error: researchError } = await supabase
            .from('researches')
            .select('id, title, file_url, credits_required')
            .eq('id', id)
            .single();

        if (researchError || !research) {
            return res.status(404).json({ error: 'Research paper not found' });
        }

        const creditsRequired = research.credits_required || 0;

        // 2.5 Verify access based on credits
        if (creditsRequired > 0) {
            // Check if user is admin
            const { data: adminCheck } = await supabase
                .from('admins')
                .select('id')
                .eq('id', userId)
                .single();

            if (!adminCheck) {
                // Not an admin, check research_access
                const { data: access } = await supabase
                    .from('research_access')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('research_id', id)
                    .single();

                if (!access) {
                    return res.status(403).json({ error: 'لم تقم بفتح هذا البحث بعد. يجب خصم رصيد.' });
                }
            }
        }

        // 3. Check if file_url is a Supabase storage path
        const fileUrl = research.file_url;

        if (!fileUrl) {
            return res.status(404).json({ error: 'PDF not available for this research' });
        }

        // If it's a Supabase storage path (starts with research-pdfs/)
        if (fileUrl.startsWith('research-pdfs/') || fileUrl.includes('/research-pdfs/')) {
            // Extract just the path within the bucket
            const storagePath = fileUrl.replace(/^.*research-pdfs\//, '');

            // Create a signed URL with short expiry (15 minutes) for viewing only
            const { data: signedUrlData, error: signedUrlError } = await supabase
                .storage
                .from('research-pdfs')
                .createSignedUrl(storagePath, 900, {
                    download: false, // Prevents download, allows inline viewing
                    transform: {
                        // Optional: Resize if it was an image, but for PDF ensure headers are right
                        // responding with correct content-type is automatic
                    }
                });

            if (signedUrlError) {
                console.error('Error creating signed URL:', signedUrlError);
                throw new AppError('Failed to generate PDF URL', 500, 'PDF_SIGNED_URL_FAILED');
            }

            return res.json({
                url: signedUrlData.signedUrl,
                title: research.title,
                expiresIn: 900, // 15 minutes
                viewOnly: true,
            });
        }

        // If it's an external URL, return it directly (legacy support)
        return res.json({
            url: fileUrl,
            title: research.title,
            viewOnly: true,
            external: true,
        });

    } catch (error) {
        console.error('Error fetching PDF:', error);
        throw new AppError('Failed to get PDF', 500, 'PDF_FETCH_FAILED');
    }
}));

export default router;
