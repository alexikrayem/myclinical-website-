import { api } from '../context/AuthContext';

export interface LicenseReport {
    code: string;
    credit_amount: number;
    redeemed_at: string;
    user_email: string;
    course_title: string;
    score: number;
    passed: boolean;
    attempted_at: string;
}

export const reportService = {
    getLicenseReport: async (params?: { search?: string; page?: number; limit?: number }) => {
        try {
            const response = await api.get('/admin/reports/licenses', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching license report:', error);
            throw error;
        }
    }
};
