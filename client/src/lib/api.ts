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

export default api;