import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../lib/api';

// Types
interface User {
    id: string;
    phone_number: string;
    display_name: string | null;
}

interface Credits {
    balance: number;
    video_watch_minutes: number;
    article_credits: number;
    total_earned: number;
    total_spent: number;
}

interface AuthContextType {
    user: User | null;
    credits: Credits | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (phoneNumber: string, password: string) => Promise<void>;
    register: (phoneNumber: string, password: string, displayName?: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshCredits: () => Promise<void>;
    updateProfile: (displayName: string) => Promise<void>;
}

const defaultCredits: Credits = {
    balance: 0,
    video_watch_minutes: 0,
    article_credits: 0,
    total_earned: 0,
    total_spent: 0
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [credits, setCredits] = useState<Credits | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            const token = localStorage.getItem('user_token');
            if (token) {
                try {
                    const response = await authApi.getProfile();
                    setUser(response.user);
                    setCredits(response.credits || defaultCredits);
                } catch (error) {
                    // Token invalid, clear it
                    localStorage.removeItem('user_token');
                    setUser(null);
                    setCredits(null);
                }
            }
            setIsLoading(false);
        };

        checkSession();
    }, []);

    const login = async (phoneNumber: string, password: string) => {
        try {
            const response = await authApi.login(phoneNumber, password);

            if (response.token) {
                localStorage.setItem('user_token', response.token);
                setUser(response.user);

                // Fetch credits after login
                await refreshCredits();
            }
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'فشل تسجيل الدخول');
        }
    };

    const register = async (phoneNumber: string, password: string, displayName?: string) => {
        try {
            const response = await authApi.register(phoneNumber, password, displayName);

            if (response.token) {
                localStorage.setItem('user_token', response.token);
                setUser(response.user);
                setCredits(defaultCredits);
            }
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'فشل إنشاء الحساب');
        }
    };

    const logout = async () => {
        try {
            await authApi.logout();
        } catch (error) {
            // Ignore logout errors
        } finally {
            localStorage.removeItem('user_token');
            setUser(null);
            setCredits(null);
        }
    };

    const refreshCredits = async () => {
        try {
            const response = await authApi.getProfile();
            setCredits(response.credits || defaultCredits);
        } catch (error) {
            console.error('Error refreshing credits:', error);
        }
    };

    const updateProfile = async (displayName: string) => {
        try {
            const response = await authApi.updateProfile(displayName);
            setUser(response.user);
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'فشل تحديث الملف الشخصي');
        }
    };

    const value: AuthContextType = {
        user,
        credits,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshCredits,
        updateProfile
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
