import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, creditsApi } from '../lib/api';

// Types
interface User {
    id: string;
    phone_number: string;
    display_name: string | null;
    role?: string;
    verification_status?: string;
    rejection_reason?: string | null;
}

interface TypedCredit {
    credit_type_id: string;
    name: string;
    prefix: string;
    balance: number;
}

interface Credits {
    balance: number;
    video_watch_minutes: number;
    article_credits: number;
    research_credits: number;
    total_earned: number;
    total_spent: number;
    typed_credits: TypedCredit[];
}

interface AuthContextType {
    user: User | null;
    credits: Credits | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (phoneNumber: string, password: string) => Promise<void>;
    register: (phoneNumber: string, password: string, displayName?: string) => Promise<void>;
    registerDoctor: (formData: FormData) => Promise<void>;
    logout: () => Promise<void>;
    refreshCredits: () => Promise<void>;
    updateProfile: (displayName: string) => Promise<void>;
}

const defaultCredits: Credits = {
    balance: 0,
    video_watch_minutes: 0,
    article_credits: 0,
    research_credits: 0,
    total_earned: 0,
    total_spent: 0,
    typed_credits: []
};

const AuthContext = createContext<AuthContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
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
            try {
                // If the user has a valid httpOnly cookie, getProfile will succeed
                const response = await authApi.getProfile();
                setUser(response.user);
                setCredits(response.credits || defaultCredits);
            } catch {
                // No session or invalid session
                setUser(null);
                setCredits(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();
    }, []);

    // Listen for the axios interceptor signalling that the session expired
    // mid-flight (e.g. token revoked on the server while the user was active).
    useEffect(() => {
        const handleExpiry = () => {
            setUser(null);
            setCredits(null);
        };
        window.addEventListener('auth:session-expired', handleExpiry);
        return () => window.removeEventListener('auth:session-expired', handleExpiry);
    }, []);


    const getApiErrorMessage = (error: unknown, fallback: string) => {
        const err = error as {
            response?: {
                data?: {
                    message?: string;
                    error?: string;
                    details?: { message?: string }[];
                };
            };
        };
        const data = err.response?.data;
        return data?.message || data?.details?.[0]?.message || data?.error || fallback;
    };

    const login = async (phoneNumber: string, password: string) => {
        try {
            const response = await authApi.login(phoneNumber, password);

            // Backend sets httpOnly cookie automatically. 
            // The response still includes 'token' for mobile, but web ignores it.
            setUser(response.user);

            // Fetch credits after login
            await refreshCredits();
        } catch (error: unknown) {
            throw new Error(getApiErrorMessage(error, 'فشل تسجيل الدخول'));
        }
    };

    const register = async (phoneNumber: string, password: string, displayName?: string) => {
        try {
            const response = await authApi.register(phoneNumber, password, displayName);

            // Backend sets httpOnly cookie automatically
            setUser(response.user);
            setCredits(defaultCredits);
        } catch (error: unknown) {
            throw new Error(getApiErrorMessage(error, 'فشل إنشاء الحساب'));
        }
    };

    const registerDoctor = async (formData: FormData) => {
        try {
            const response = await authApi.registerDoctor(formData);

            // Backend sets httpOnly cookie automatically
            setUser(response.user);
            setCredits(defaultCredits);
        } catch (error: unknown) {
            throw new Error(getApiErrorMessage(error, 'فشل إنشاء الحساب المهني للطبيب'));
        }
    };

    const logout = async () => {
        try {
            await authApi.logout();
        } catch {
            // Ignore logout errors
        } finally {
            setUser(null);
            setCredits(null);
        }
    };

    const refreshCredits = async () => {
        try {
            // M1 fix: use the lightweight credits endpoint instead of the full profile fetch
            const balance = await creditsApi.getBalance();
            setCredits(balance || defaultCredits);
        } catch (error) {
            console.error('Error refreshing credits:', error);
        }
    };

    const updateProfile = async (displayName: string) => {
        try {
            const response = await authApi.updateProfile(displayName);
            setUser(response.user);
        } catch (error: unknown) {
            throw new Error(getApiErrorMessage(error, 'فشل تحديث الملف الشخصي'));
        }
    };

    const value: AuthContextType = {
        user,
        credits,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        registerDoctor,
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
