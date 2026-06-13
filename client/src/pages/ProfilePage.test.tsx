import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ProfilePage from './ProfilePage';
import { useAuth } from '../context/AuthContext';
import { creditsApi, authApi } from '../lib/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual as any,
        useNavigate: vi.fn(),
        useSearchParams: vi.fn(() => [new URLSearchParams()]),
        BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    };
});

vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn()
}));

vi.mock('../lib/api', () => ({
    creditsApi: {
        getTransactions: vi.fn()
    },
    authApi: {
        changePassword: vi.fn()
    }
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../components/credits/CreditRedeemModal', () => ({
    default: ({ isOpen, onClose }: any) => isOpen ? <div data-testid="redeem-modal">Modal <button onClick={onClose}>Close</button></div> : null
}));

describe('ProfilePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('renders loading spinner when isLoading is true', () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ isLoading: true });
        const { container } = render(<ProfilePage />);
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('navigates to login if not authenticated', () => {
        const mockNavigate = vi.fn();
        vi.mocked(useNavigate).mockReturnValue(mockNavigate);

        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isLoading: false,
            isAuthenticated: false
        });

        render(<ProfilePage />);
        expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { from: { pathname: '/profile' } } });
        expect(screen.queryByText('معلومات الحساب')).not.toBeInTheDocument();
    });

    it('renders user details and credits when authenticated', () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isLoading: false,
            isAuthenticated: true,
            user: { display_name: 'Test Doc', phone_number: '+123456789' },
            credits: {
                balance: 100,
                video_watch_minutes: 50,
                article_credits: 20,
                research_credits: 5,
                typed_credits: [{ credit_type_id: 1, name: 'Special Credit', balance: 10 }]
            }
        });

        render(<ProfilePage />);
        expect(screen.getAllByText('Test Doc').length).toBeGreaterThan(0);
        expect(screen.getAllByText('+123456789').length).toBeGreaterThan(0);
        expect(screen.getByText('100')).toBeInTheDocument(); // Balance
        expect(screen.getByText('10')).toBeInTheDocument(); // Typed credit
        expect(screen.getByText('Special Credit')).toBeInTheDocument();
    });

    it('allows editing and saving profile', async () => {
        const updateProfileMock = vi.fn().mockResolvedValue({});
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isLoading: false,
            isAuthenticated: true,
            user: { display_name: 'Test Doc', phone_number: '+123456789' },
            updateProfile: updateProfileMock
        });

        render(<ProfilePage />);

        const editButton = screen.getByText('تعديل');
        fireEvent.click(editButton);

        const input = screen.getByDisplayValue('Test Doc');
        fireEvent.change(input, { target: { value: 'New Name' } });

        const saveButton = screen.getByText('حفظ');
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(updateProfileMock).toHaveBeenCalledWith('New Name');
            expect(toast.success).toHaveBeenCalledWith('تم تحديث الملف الشخصي');
        });
    });

    it('validates password fields and calls changePassword', async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isLoading: false,
            isAuthenticated: true,
            user: { display_name: 'Test Doc' }
        });
        (authApi.changePassword as ReturnType<typeof vi.fn>).mockResolvedValue({});

        render(<ProfilePage />);

        // Go to security tab
        fireEvent.click(screen.getByText('الأمان'));

        const currentPasswordInput = screen.getByLabelText('كلمة المرور الحالية');
        const newPasswordInput = screen.getByLabelText('كلمة المرور الجديدة');
        const confirmPasswordInput = screen.getByLabelText('تأكيد كلمة المرور الجديدة');
        const submitButton = screen.getByRole('button', { name: 'تغيير كلمة المرور' });

        // Test mismatch
        fireEvent.change(currentPasswordInput, { target: { value: 'oldpass123' } });
        fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'mismatch' } });
        fireEvent.click(submitButton);

        expect(toast.error).toHaveBeenCalledWith('كلمتا المرور غير متطابقتين');

        // Test length condition
        fireEvent.change(newPasswordInput, { target: { value: 'short' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'short' } });
        fireEvent.click(submitButton);

        expect(toast.error).toHaveBeenCalledWith('كلمة المرور يجب أن تكون 8 أحرف على الأقل');

        // Test success
        fireEvent.change(newPasswordInput, { target: { value: 'validpass123' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'validpass123' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(authApi.changePassword).toHaveBeenCalledWith('oldpass123', 'validpass123');
            expect(toast.success).toHaveBeenCalledWith('تم تغيير كلمة المرور بنجاح');
        });
    });

    it('fetches and renders transactions in History tab', async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isLoading: false,
            isAuthenticated: true,
            user: { display_name: 'Test Doc' }
        });

        const mockTransactions = [
            { id: 1, transaction_type: 'redeem', amount: 50, transaction_date: '2026-05-01T00:00:00Z', description: 'Redeemed code' },
            { id: 2, transaction_type: 'usage', amount: -10, transaction_date: '2026-05-02T00:00:00Z', description: 'Watched video' }
        ];

        (creditsApi.getTransactions as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockTransactions });

        render(<ProfilePage />);

        // Go to History tab
        fireEvent.click(screen.getByText('السجل'));

        await waitFor(() => {
            expect(creditsApi.getTransactions).toHaveBeenCalledWith(1, 20);
            expect(screen.getByText('Redeemed code')).toBeInTheDocument();
            expect(screen.getByText('Watched video')).toBeInTheDocument();
            expect(screen.getByText('+50')).toBeInTheDocument();
            expect(screen.getByText('-10')).toBeInTheDocument();
        });
    });
});
