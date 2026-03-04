import { api } from '../context/AuthContext';

export interface GeneratedCode {
    id: string;
    code: string;
    credit_amount: number;
    credit_type: string; // 'universal', 'video', 'article', 'both'
    video_minutes: number;
    article_count: number;
    is_redeemed: boolean;
    redeemed_at?: string;
    created_at: string;
}

export interface GenerateCodesResponse {
    codes: GeneratedCode[];
    count: number;
}

export interface CodesHistoryResponse {
    data: GeneratedCode[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}

export const codeService = {
    generate: async (
        amount: number,
        creditValue: number,
        prefix: string,
        creditType: string = 'universal',
        videoMinutes: number = 0,
        articleCount: number = 0
    ): Promise<GenerateCodesResponse> => {
        const response = await api.post('/admin/codes/generate', {
            amount,
            credit_value: creditValue,
            prefix,
            credit_type: creditType,
            video_minutes: videoMinutes,
            article_count: articleCount
        });
        return response.data;
    },

    getHistory: async (page: number = 1, limit: number = 20): Promise<CodesHistoryResponse> => {
        const response = await api.get('/admin/codes/history', {
            params: { page, limit }
        });
        return response.data;
    }
};