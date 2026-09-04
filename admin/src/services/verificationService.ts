import { api } from '../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types — reflecting the new verification_submissions table
// ─────────────────────────────────────────────────────────────────────────────

export interface VerificationUser {
  id: string;
  display_name: string | null;
  social_provider: 'facebook' | 'instagram' | null;
  social_username: string | null;
  social_profile_url: string | null;
  social_avatar_url: string | null;
  specialty: string | null;
  is_verified: boolean;
  verification_status: 'none' | 'pending' | 'approved' | 'rejected';
}

export interface PendingSubmission {
  id: string;
  full_name: string;
  specialty: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  users: VerificationUser;
}

export interface DocumentUrls {
  personal_id_url: string;
  medical_id_url: string;
  practice_license_url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const verificationService = {
  /**
   * Fetches all pending verification submissions.
   */
  getPending: async (): Promise<PendingSubmission[]> => {
    const response = await api.get('/admin/verifications');
    return response.data;
  },

  /**
   * Returns signed URLs (15-minute expiry) for all three verification documents.
   * Old single card URL endpoint replaced with a multi-document endpoint.
   */
  getDocumentUrls: async (submissionId: string): Promise<DocumentUrls> => {
    const response = await api.get(`/admin/verifications/${submissionId}/documents`);
    return response.data as DocumentUrls;
  },

  approve: async (submissionId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/admin/verifications/${submissionId}/approve`);
    return response.data;
  },

  reject: async (
    submissionId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/admin/verifications/${submissionId}/reject`, {
      rejection_reason: reason,
    });
    return response.data;
  },
};
