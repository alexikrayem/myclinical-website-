import React, { createContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const defaultContext: AuthContextType = {
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  isAuthenticated: false,
};

export const AuthContext = createContext<AuthContextType>(defaultContext);

interface AuthProviderProps {
  children: ReactNode;
}

// Create axios instance for API calls
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        if (token) {
          // Set authorization header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Verify token by fetching admin profile
          const response = await api.get('/admin/profile');
          setUser(response.data);
        }
      } catch (error) {
        console.error('Session check failed:', error);
        // Clear invalid token
        localStorage.removeItem('admin_token');
        delete api.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const response = await api.post('/admin/login', {
        email,
        password,
      });

      const { user: userData, session } = response.data;
      
      if (session && session.access_token) {
        // Store token
        localStorage.setItem('admin_token', session.access_token);
        
        // Set authorization header for future requests
        api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
        
        // Set user data
        setUser(userData);
      } else {
        throw new Error('No session data received');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Clear local storage
      localStorage.removeItem('admin_token');
      
      // Clear authorization header
      delete api.defaults.headers.common['Authorization'];
      
      // Clear user state
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);

// Export the configured axios instance for use in other components
export { api };