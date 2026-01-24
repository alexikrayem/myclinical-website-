import { api } from '../context/AuthContext';

export interface Course {
    id: string;
    title: string;
    description: string;
    cover_image: string;
    video_url: string;
    transcript?: string;
    author: string;
    categories: string[];
    credits_required: number;
    is_featured: boolean;
    duration: number;
    publication_date: string;
}

export const courseService = {
    getAll: async (params?: { search?: string; page?: number; limit?: number }) => {
        const response = await api.get('/courses', { params });
        return response.data;
    },

    getById: async (id: string) => {
        const response = await api.get(`/courses/${id}`);
        return response.data;
    },

    create: async (data: FormData) => {
        const response = await api.post('/courses', data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    update: async (id: string, data: FormData) => {
        const response = await api.put(`/courses/${id}`, data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/courses/${id}`);
        return response.data;
    },

    generateQuiz: async (id: string) => {
        const response = await api.post(`/courses/${id}/generate-quiz`);
        return response.data;
    }
};
