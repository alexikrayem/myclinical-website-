import axios from 'axios';

// Get API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Global Search API
export const searchApi = {
  // Search across all content types
  searchAll: async (query: string, limit = 5) => {
    try {
      const [articlesData, researchData, coursesData] = await Promise.all([
        articlesApi.search(query, limit),
        researchApi.search(query, limit),
        coursesApi.getAll({ search: query, limit })
      ]);

      const results = [
        ...(articlesData.data || []).map((item: any) => ({ ...item, type: 'article' })),
        ...(researchData.data || []).map((item: any) => ({ ...item, type: 'research' })),
        ...(coursesData.data || []).map((item: any) => ({ ...item, type: 'course' }))
      ].slice(0, limit);

      return results;
    } catch (error) {
      console.error('Error in global search:', error);
      return [];
    }
  }
};

// Articles API
export const articlesApi = {
  // Get all articles with optional filters
  getAll: async (params?: { tag?: string; search?: string; limit?: number; page?: number }) => {
    try {
      const response = await api.get('/articles', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }
  },

  // Get featured articles
  getFeatured: async () => {
    try {
      const response = await api.get('/articles/featured');
      return response.data;
    } catch (error) {
      console.error('Error fetching featured articles:', error);
      throw error;
    }
  },

  // Get all unique tags
  getTags: async () => {
    try {
      const response = await api.get('/articles/tags');
      return response.data;
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  },

  // Get single article by ID
  getById: async (id: string) => {
    try {
      const response = await api.get(`/articles/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching article:', error);
      throw error;
    }
  },

  // Get related articles
  getRelated: async (id: string, limit = 3) => {
    try {
      const response = await api.get(`/articles/${id}/related`, { params: { limit } });
      return response.data;
    } catch (error) {
      console.error('Error fetching related articles:', error);
      return [];
    }
  },

  // Search articles
  search: async (query: string, limit = 10, page = 1) => {
    try {
      const response = await api.get('/articles', {
        params: {
          search: query,
          limit,
          page
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching articles:', error);
      throw error;
    }
  },
};

// Research API
export const researchApi = {
  // Get all research papers with optional filters
  getAll: async (params?: { journal?: string; search?: string; limit?: number; page?: number }) => {
    try {
      const response = await api.get('/research', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching research papers:', error);
      throw error;
    }
  },

  // Get single research paper by ID
  getById: async (id: string) => {
    try {
      const response = await api.get(`/research/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching research paper:', error);
      throw error;
    }
  },

  // Get related research papers
  getRelated: async (id: string, limit = 3) => {
    try {
      const response = await api.get(`/research/${id}/related`, { params: { limit } });
      return response.data;
    } catch (error) {
      console.error('Error fetching related research:', error);
      return [];
    }
  },

  // Get available journals
  getJournals: async () => {
    try {
      const response = await api.get('/research/journals/list');
      return response.data;
    } catch (error) {
      console.error('Error fetching journals:', error);
      return [];
    }
  },

  // Search research papers
  search: async (query: string, limit = 10, page = 1) => {
    try {
      const response = await api.get('/research', {
        params: {
          search: query,
          limit,
          page
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching research papers:', error);
      throw error;
    }
  },
};

// Authors API
export const authorsApi = {
  // Get author by name
  getByName: async (name: string) => {
    try {
      const response = await api.get(`/authors/${encodeURIComponent(name)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching author:', error);
      return null;
    }
  },
};

// Courses API
export const coursesApi = {
  getAll: async (params?: { category?: string; search?: string; limit?: number; page?: number; featured?: boolean }) => {
    try {
      const response = await api.get('/courses', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching courses:', error);
      throw error;
    }
  },

  getFeatured: async () => {
    try {
      const response = await api.get('/courses/featured');
      return response.data;
    } catch (error) {
      console.error('Error fetching featured courses:', error);
      throw error;
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/courses/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching course:', error);
      throw error;
    }
  },

  purchaseAccess: async (id: string) => {
    try {
      const token = getUserToken();
      const response = await api.post(`/courses/${id}/access`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error purchasing access:', error);
      throw error;
    }
  },

  getQuiz: async (id: string) => {
    try {
      const token = getUserToken();
      const response = await api.get(`/courses/${id}/quiz`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching quiz:', error);
      throw error;
    }
  },

  submitQuiz: async (courseId: string, quizId: string, answers: number[]) => {
    try {
      const token = getUserToken();
      const response = await api.post(`/courses/${courseId}/quiz/submit`, { quizId, answers }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting quiz:', error);
      throw error;
    }
  }
};

// Helper to get user token
const getUserToken = () => localStorage.getItem('user_token');

// Auth API for regular users (phone + password)
export const authApi = {
  register: async (phoneNumber: string, password: string, displayName?: string) => {
    try {
      const response = await api.post('/auth/register', {
        phone_number: phoneNumber,
        password,
        display_name: displayName
      });
      return response.data;
    } catch (error) {
      console.error('Error registering:', error);
      throw error;
    }
  },

  login: async (phoneNumber: string, password: string) => {
    try {
      const response = await api.post('/auth/login', {
        phone_number: phoneNumber,
        password
      });
      return response.data;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      const token = getUserToken();
      if (token) {
        await api.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  },

  getProfile: async () => {
    try {
      const token = getUserToken();
      const response = await api.get('/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  },

  updateProfile: async (displayName: string) => {
    try {
      const token = getUserToken();
      const response = await api.put('/auth/profile',
        { display_name: displayName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    try {
      const token = getUserToken();
      const response = await api.put('/auth/change-password',
        { current_password: currentPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }
};

// Credits API (uses user_token for regular users)
export const creditsApi = {
  getBalance: async () => {
    try {
      const token = getUserToken();
      const response = await api.get('/credits/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching credit balance:', error);
      throw error;
    }
  },

  redeemCode: async (code: string) => {
    try {
      const token = getUserToken();
      const response = await api.post('/credits/redeem', { code }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error redeeming code:', error);
      throw error;
    }
  },

  consumeVideo: async (minutes: number, courseId: string) => {
    try {
      const token = getUserToken();
      const response = await api.post('/credits/consume-video',
        { minutes, course_id: courseId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error consuming video credits:', error);
      throw error;
    }
  },

  consumeArticle: async (articleId: string) => {
    try {
      const token = getUserToken();
      const response = await api.post('/credits/consume-article',
        { article_id: articleId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error consuming article credits:', error);
      throw error;
    }
  },

  checkArticleAccess: async (articleId: string) => {
    try {
      const token = getUserToken();
      const response = await api.get(`/credits/check-article-access/${articleId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      return response.data;
    } catch (error) {
      console.error('Error checking article access:', error);
      throw error;
    }
  },

  getTransactions: async (page = 1, limit = 10, type?: string) => {
    try {
      const token = getUserToken();
      const response = await api.get('/credits/transactions', {
        params: { page, limit, type },
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }
};

// Admin API
export const adminApi = {
  getLicenseReport: async (params?: { search?: string; page?: number; limit?: number }) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await api.get('/admin/reports/licenses', {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching license report:', error);
      throw error;
    }
  }
};

export default api;