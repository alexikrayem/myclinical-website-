import { api } from '../context/AuthContext';

export interface PendingDoctor {
  id: string;
  phone_number: string;
  display_name: string;
  role: string;
  verification_status: 'none' | 'pending' | 'approved' | 'rejected';
  specialization: string;
  bio: string;
  education: string;
  experience_years: number;
  clinic_address: string;
  email: string | null;
  website: string | null;
  created_at: string;
}

export const verificationService = {
  getPending: async (): Promise<PendingDoctor[]> => {
    const response = await api.get('/admin/verifications');
    return response.data;
  },

  getCardUrl: async (id: string): Promise<string> => {
    const response = await api.get(`/admin/verifications/${id}/card`);
    return response.data.signedUrl;
  },

  approve: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/admin/verifications/${id}/approve`);
    return response.data;
  },

  reject: async (id: string, reason: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/admin/verifications/${id}/reject`, {
      rejection_reason: reason,
    });
    return response.data;
  },
};
