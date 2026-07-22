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

interface ErrorWithResponse {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
  message?: string;
}

const defaultContext: AuthContextType = {
  user: null,
  loading: true,
  login: async () => { },
  logout: async () => { },
  isAuthenticated: false,
};

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType>(defaultContext);

interface AuthProviderProps {
  children: ReactNode;
}

// Create axios instance for API calls.
// withCredentials=true ensures the httpOnly `session` cookie is sent automatically.
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth-error codes that signal the admin session is definitively dead
const ADMIN_SESSION_EXPIRED_CODES = new Set([
  'NO_TOKEN', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'SESSION_EXPIRED',
  'ACCOUNT_DISABLED', 'NOT_ADMIN', 'AUTH_FAILED',
]);

// Intercept responses to map standardized AppError payloads to axios error messages
// and to auto-logout on definitively expired/invalidated sessions
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code: string | undefined = error.response?.data?.code;

    if ((status === 401 || status === 403) && code && ADMIN_SESSION_EXPIRED_CODES.has(code)) {
      // Notify the AuthContext that the session is dead.
      // The cookie is cleared server-side by the logout endpoint.
      window.dispatchEvent(new CustomEvent('admin:session-expired'));
    }

    if (error.response?.data?.error) {
      error.message = error.response.data.error;
    } else if (error.response?.data?.message) {
      error.message = error.response.data.message;
    }
    return Promise.reject(error);
  }
);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        // If a valid httpOnly cookie exists, this will succeed
        const response = await api.get('/admin/profile');
        setUser(response.data);
      } catch (error) {
        console.error('Session check failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // React to expired-session events dispatched by the axios interceptor
  useEffect(() => {
    const handleExpiry = () => {
      setUser(null);
    };
    window.addEventListener('admin:session-expired', handleExpiry);
    return () => window.removeEventListener('admin:session-expired', handleExpiry);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);

      const response = await api.post('/admin/login', {
        email,
        password,
      });

      // Backend now sets the httpOnly session cookie.
      // We no longer receive (or need) an access_token in the response body.
      const { user: userData } = response.data;

      if (userData) {
        setUser(userData);
      } else {
        throw new Error('No user data received');
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
      const candidate = error as ErrorWithResponse;
      const errorMessage = candidate.response?.data?.error || candidate.message || 'Login failed';
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call backend to clear the httpOnly cookie and revoke the token
      await api.post('/admin/logout', {});
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state
      setUser(null);
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => React.useContext(AuthContext);

// Export the configured axios instance for use in other components
// eslint-disable-next-line react-refresh/only-export-components
export { api };
