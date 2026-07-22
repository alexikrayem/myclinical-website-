import axios from 'axios';

// Get API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Create axios instance.
// withCredentials=true ensures the httpOnly `user_session` cookie is sent
// on every request — no manual Authorization header injection needed.
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth-error codes returned by the backend that mean the session is no longer valid
const SESSION_EXPIRED_CODES = new Set([
  'NO_TOKEN', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'SESSION_EXPIRED',
  'ACCOUNT_DISABLED', 'NO_USER',
]);

// Intercept responses to (a) map error payloads and (b) auto-logout on expired sessions
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code: string | undefined = error.response?.data?.code;

    // Auto-logout when the backend explicitly signals the session is dead
    if ((status === 401 || status === 403) && code && SESSION_EXPIRED_CODES.has(code)) {
      // Notify the AuthContext (or any listener) without a hard redirect
      // so the app can show the login modal rather than a blank page.
      // The cookie is cleared server-side by the logout endpoint.
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }

    // Map standardised AppError payloads to axios error messages
    if (error.response?.data?.error) {
      error.message = error.response.data.error;
    } else if (error.response?.data?.message) {
      error.message = error.response.data.message;
    }
    return Promise.reject(error);
  }
);


import { GlobalSearchResult } from '../types';



// Global Search API
export const searchApi = {
  // Search across all content types
  searchAll: async (query: string, limit = 5): Promise<GlobalSearchResult[]> => {
    try {
      const response = await api.get('/search', { params: { q: query, limit } });
      const results = response.data.results || [];
      return results.map((item: Record<string, unknown>) => ({
        ...item,
        id: String(item.id),
        type: item.type === 'articles' ? 'article' :
          item.type === 'researches' ? 'research' :
            item.type === 'courses' ? 'course' : item.type
      }));
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
      throw error;
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
      throw error;
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

  // Get latest articles grouped by tags
  getByTags: async (tags?: string[], limit = 5) => {
    try {
      const params: Record<string, string | number> = { limit };
      if (tags && tags.length > 0) {
        params.tags = tags.join(',');
      }
      const response = await api.get('/articles/by-tags', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching articles by tags:', error);
      throw error;
    }
  },
};

// Research API
export const researchApi = {
  // Get featured research papers
  getFeatured: async () => {
    try {
      const response = await api.get('/research/featured');
      return response.data;
    } catch (error) {
      console.error('Error fetching featured research:', error);
      throw error;
    }
  },

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
      throw error;
    }
  },

  // Get available journals
  getJournals: async () => {
    try {
      const response = await api.get('/research/journals/list');
      return response.data;
    } catch (error) {
      console.error('Error fetching journals:', error);
      throw error;
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
      throw error;
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

  getCategories: async (): Promise<string[]> => {
    try {
      const response = await api.get('/courses/categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching course categories:', error);
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

  getPlayback: async (id: string) => {
    try {
      const response = await api.post(`/courses/${id}/playback`, {});
      return response.data;
    } catch (error) {
      console.error('Error starting playback:', error);
      throw error;
    }
  },

  refreshPlayback: async (id: string, sessionId: string) => {
    try {
      const response = await api.post(`/courses/${id}/playback/refresh`, { session_id: sessionId });
      return response.data;
    } catch (error) {
      console.error('Error refreshing playback:', error);
      throw error;
    }
  },

  sendHeartbeat: async (id: string, payload: { session_id: string; seconds_delta: number; idempotency_key?: string }) => {
    try {
      const response = await api.post(`/courses/${id}/heartbeat`, payload);
      return response.data;
    } catch (error) {
      console.error('Error sending heartbeat:', error);
      throw error;
    }
  },

  purchaseAccess: async (id: string) => {
    try {
      const idempotencyKey = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await api.post(`/courses/${id}/access`, { idempotency_key: idempotencyKey });
      return response.data;
    } catch (error) {
      console.error('Error purchasing access:', error);
      throw error;
    }
  },

  getQuiz: async (id: string) => {
    try {
      const response = await api.get(`/courses/${id}/quiz`);
      return response.data;
    } catch (error) {
      console.error('Error fetching quiz:', error);
      throw error;
    }
  },

  submitQuiz: async (courseId: string, quizId: string, answers: number[]) => {
    try {
      const response = await api.post(`/courses/${courseId}/quiz/submit`, { quizId, answers });
      return response.data;
    } catch (error) {
      console.error('Error submitting quiz:', error);
      throw error;
    }
  },

  getAttentionCheck: async (courseId: string, sessionId: string, currentSeconds: number) => {
    try {
      const response = await api.get(`/courses/${courseId}/attention-check`, {
        params: { session_id: sessionId, current_seconds: currentSeconds },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching attention check:', error);
      throw error;
    }
  },

  verifyAttentionCheck: async (courseId: string, payload: {
    session_id: string;
    challenge_id: string;
    answer?: string;
    expired?: boolean;
  }) => {
    try {
      const response = await api.post(`/courses/${courseId}/attention-check/verify`, payload);
      return response.data;
    } catch (error) {
      console.error('Error verifying attention check:', error);
      throw error;
    }
  }
};

// Auth API for regular users (phone + password)
export const authApi = {
  register: async (phoneNumber: string, password: string, displayName?: string) => {
    try {
      const response = await api.post('/auth/register', {
        phone_number: phoneNumber,
        password,
        display_name: displayName || undefined
      });
      return response.data;
    } catch (error) {
      console.error('Error registering:', error);
      throw error;
    }
  },

  registerDoctor: async (formData: FormData) => {
    try {
      const response = await api.post('/auth/register-doctor', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error registering doctor:', error);
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
      await api.post('/auth/logout', {});
    } catch (error) {
      console.error('Error logging out:', error);
    }
  },

  getProfile: async () => {
    try {
      const response = await api.get('/auth/profile');
      return response.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }
  },

  updateProfile: async (displayName: string) => {
    try {
      const response = await api.put('/auth/profile',
        { display_name: displayName }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    try {
      const response = await api.put('/auth/change-password',
        { current_password: currentPassword, new_password: newPassword }
      );
      return response.data;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }
};

// Credits API
export const creditsApi = {
  getBalance: async () => {
    try {
      const response = await api.get('/credits/balance');
      return response.data;
    } catch (error) {
      console.error('Error fetching credit balance:', error);
      throw error;
    }
  },

  redeemCode: async (code: string) => {
    try {
      const response = await api.post('/credits/redeem', { code });
      return response.data;
    } catch (error) {
      console.error('Error redeeming code:', error);
      throw error;
    }
  },

  consumeVideo: async (minutes: number, courseId: string) => {
    try {
      const response = await api.post('/credits/consume-video',
        { minutes, course_id: courseId }
      );
      return response.data;
    } catch (error) {
      console.error('Error consuming video credits:', error);
      throw error;
    }
  },

  consumeArticle: async (articleId: string) => {
    try {
      const response = await api.post('/credits/consume-article',
        { article_id: articleId }
      );
      return response.data;
    } catch (error) {
      console.error('Error consuming article credits:', error);
      throw error;
    }
  },

  checkArticleAccess: async (articleId: string) => {
    try {
      const response = await api.get(`/credits/check-article-access/${articleId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking article access:', error);
      throw error;
    }
  },

  consumeResearch: async (researchId: string) => {
    try {
      const response = await api.post('/credits/consume-research',
        { research_id: researchId }
      );
      return response.data;
    } catch (error) {
      console.error('Error consuming research credits:', error);
      throw error;
    }
  },

  checkResearchAccess: async (researchId: string) => {
    try {
      const response = await api.get(`/credits/check-research-access/${researchId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking research access:', error);
      throw error;
    }
  },

  getTransactions: async (page = 1, limit = 10, type?: string) => {
    try {
      const response = await api.get('/credits/transactions', {
        params: { page, limit, type },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }
};

// Admin API — uses the httpOnly `session` cookie set by admin login
export const adminApi = {
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

export default api;
