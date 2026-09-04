import { api } from '../context/AuthContext';

export type Submission = {
  id: string; type: 'article' | 'course'; title: string; description?: string; content?: string;
  excerpt?: string; status: string; audience?: string; visibility?: string; cover_image?: string;
  submitter?: { display_name?: string; phone_number?: string } | null;
};

export const submissionService = {
  list: async (type: 'article' | 'course' = 'article', status = 'pending'): Promise<Submission[]> => (await api.get('/admin/submissions', { params: { type, status } })).data,
  get: async (type: 'article' | 'course', id: string): Promise<Submission> => (await api.get(`/admin/submissions/${type}/${id}`)).data,
  approve: async (type: 'article' | 'course', id: string) => (await api.post(`/admin/submissions/${type}/${id}/approve`)).data,
  reject: async (type: 'article' | 'course', id: string, rejection_reason: string) => (await api.post(`/admin/submissions/${type}/${id}/reject`, { rejection_reason })).data,
};
