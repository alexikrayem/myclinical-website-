import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
router.get('/:id/pdf', async (req, res) => {
    try {
        const { id } = req.params;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        // 1. Verify user is authenticated
        if (!token) {
            return res.status(401).json({ error: 'Authentication required to view PDF' });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // 2. Get research paper details
        const { data: research, error: researchError } = await supabase
            .from('researches')
            .select('id, title, file_url')
            .eq('id', id)
            .single();

        if (researchError || !research) {
            return res.status(404).json({ error: 'Research paper not found' });
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
                return res.status(500).json({ error: 'Failed to generate PDF URL' });
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
        res.status(500).json({ error: 'Failed to get PDF' });
    }
});

export default router;
