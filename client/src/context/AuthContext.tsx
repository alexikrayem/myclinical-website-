import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, creditsApi } from '../lib/api';

// =============================================================================
// Types
// =============================================================================

interface User {
    id: string;
    display_name: string | null;
    social_provider: 'facebook' | 'instagram' | null;
    social_username: string | null;
    social_profile_url: string | null;
    social_avatar_url: string | null;
    specialty: string | null;
    is_verified: boolean;
    verification_status?: 'none' | 'pending' | 'approved' | 'rejected';
    role?: string;
    // Legacy — may be null for social-auth users
    phone_number?: string | null;
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
    /** Exchange an OAuth code from Meta for a session. Optionally provide specialty for new-user registration. */
    socialLogin: (
        provider: 'facebook' | 'instagram',
        code: string,
        specialty?: string
    ) => Promise<{ isNewUser: boolean }>;
    /** Authenticated users submit professional verification documents. */
    submitVerification: (formData: FormData) => Promise<void>;
    logout: () => Promise<void>;
    refreshCredits: () => Promise<void>;
    updateProfile: (updates: { display_name?: string; specialty?: string }) => Promise<void>;
}

// =============================================================================
// Context
// =============================================================================

const defaultCredits: Credits = {
    balance: 0,
    video_watch_minutes: 0,
    article_credits: 0,
    research_credits: 0,
    total_earned: 0,
    total_spent: 0,
    typed_credits: [],
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
                const response = await authApi.getProfile();
                setUser(response.user);
                setCredits(response.credits || defaultCredits);
            } catch {
                setUser(null);
                setCredits(null);
            } finally {
                setIsLoading(false);
            }
        };
        checkSession();
    }, []);

    // Listen for session-expired events dispatched by the axios interceptor
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
                    code?: string;
                    details?: { message?: string }[];
                };
            };
        };
        const data = err.response?.data;
        // Surface backend error code for caller to branch on (e.g. SPECIALTY_REQUIRED)
        const code = data?.code;
        const message = data?.message || data?.details?.[0]?.message || data?.error || fallback;
        if (code) {
            const e = new Error(message);
            (e as Error & { code: string }).code = code;
            throw e;
        }
        throw new Error(message);
    };

    // ── socialLogin ──────────────────────────────────────────────────────────
    const socialLogin = async (
        provider: 'facebook' | 'instagram',
        code: string,
        specialty?: string
    ): Promise<{ isNewUser: boolean }> => {
        try {
            const response = await authApi.socialCallback(provider, code, specialty);
            setUser(response.user);
            await refreshCredits();
            return { isNewUser: response.isNewUser };
        } catch (error: unknown) {
            return getApiErrorMessage(error, 'فشل تسجيل الدخول الاجتماعي');
        }
    };

    // ── submitVerification ───────────────────────────────────────────────────
    const submitVerification = async (formData: FormData): Promise<void> => {
        try {
            await authApi.submitVerification(formData);
            // Refresh profile to get updated verification_status
            const profile = await authApi.getProfile();
            setUser(profile.user);
        } catch (error: unknown) {
            return getApiErrorMessage(error, 'فشل تقديم طلب التوثيق');
        }
    };

    // ── logout ───────────────────────────────────────────────────────────────
    const logout = async () => {
        try {
            await authApi.logout();
        } catch {
            // Ignore logout errors — always clear local state
        } finally {
            setUser(null);
            setCredits(null);
        }
    };

    // ── refreshCredits ────────────────────────────────────────────────────────
    const refreshCredits = async () => {
        try {
            const balance = await creditsApi.getBalance();
            setCredits(balance || defaultCredits);
        } catch (error) {
            console.error('Error refreshing credits:', error);
        }
    };

    // ── updateProfile ─────────────────────────────────────────────────────────
    const updateProfile = async (updates: { display_name?: string; specialty?: string }) => {
        try {
            const response = await authApi.updateProfile(updates);
            setUser((prev) => prev ? { ...prev, ...response.user } : response.user);
        } catch (error: unknown) {
            return getApiErrorMessage(error, 'فشل تحديث الملف الشخصي');
        }
    };

    const value: AuthContextType = {
        user,
        credits,
        isAuthenticated: !!user,
        isLoading,
        socialLogin,
        submitVerification,
        logout,
        refreshCredits,
        updateProfile,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
