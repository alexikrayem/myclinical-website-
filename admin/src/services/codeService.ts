import { api } from '../context/AuthContext';

export interface GeneratedCode {
    code: string;
}

export interface GenerateCodesResponse {
    codes: GeneratedCode[];
    count: number;
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
    }
};
