import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AuthModal from './AuthModal';
import { useAuth } from '../../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

// Provide router context for Links
const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('AuthModal', () => {
    const mockLogin = vi.fn();
    const mockRegister = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            login: mockLogin,
            register: mockRegister,
        });
    });

    it('returns null if isOpen is false', () => {
        const { container } = renderWithRouter(<AuthModal isOpen={false} onClose={mockOnClose} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders login mode initially if specified', () => {
        renderWithRouter(<AuthModal isOpen={true} onClose={mockOnClose} initialMode="login" />);
        expect(screen.getByText('أهلاً بعودتك! 👋')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /تسجيل الدخول/i, hidden: true })).toBeInTheDocument();
    });

    it('switches to register mode when button is clicked', () => {
        renderWithRouter(<AuthModal isOpen={true} onClose={mockOnClose} />);

        // Click register tab
        fireEvent.click(screen.getByRole('button', { name: 'حساب جديد' }));

        expect(screen.getByText('ابدأ رحلتك معنا 🚀')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('مثال: أحمد محمد')).toBeInTheDocument();
    });

    it('handles login sumbit successfully', async () => {
        renderWithRouter(<AuthModal isOpen={true} onClose={mockOnClose} />);

        const phoneInput = screen.getByPlaceholderText('09xxxxxxxx');
        const passwordInput = screen.getByPlaceholderText('••••••••');

        fireEvent.change(phoneInput, { target: { value: '0912345678' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        const submitBtns = screen.getAllByRole('button', { name: /تسجيل الدخول/i });
        // Tab button is login, submit button is login
        const loginSubmitButton = submitBtns[submitBtns.length - 1];
        fireEvent.submit(loginSubmitButton.closest('form')!);

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('0912345678', 'password123');
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    it('validates registration inputs', async () => {
        renderWithRouter(<AuthModal isOpen={true} onClose={mockOnClose} initialMode="register" />);

        const submitBtn = screen.getAllByRole('button', { name: /إنشاء الحساب/i }).find(btn => btn.closest('form'));

        // Attempt submit with bad phone and password
        const phoneInput = screen.getByPlaceholderText('09xxxxxxxx');
        const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
        const confirmInput = screen.getAllByPlaceholderText('••••••••')[1];
        const nameInput = screen.getByPlaceholderText('مثال: أحمد محمد');

        fireEvent.change(nameInput, { target: { value: 'Test User' } });
        fireEvent.change(phoneInput, { target: { value: '123' } });
        fireEvent.change(passwordInput, { target: { value: 'weak' } });
        fireEvent.change(confirmInput, { target: { value: 'weak123' } });

        fireEvent.submit(submitBtn!.closest('form')!);

        await waitFor(() => {
            expect(screen.getByText('رقم الهاتف يجب أن يكون بالصيغة 09xxxxxxxx')).toBeInTheDocument();
            expect(mockRegister).not.toHaveBeenCalled();
        });

        // Fix phone, test password validation
        fireEvent.change(phoneInput, { target: { value: '0912345678' } });
        fireEvent.submit(submitBtn!.closest('form')!);

        await waitFor(() => {
            expect(screen.getByText('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم')).toBeInTheDocument();
            expect(mockRegister).not.toHaveBeenCalled();
        });

        // Fix password, test mismatch
        fireEvent.change(passwordInput, { target: { value: 'validPass123' } });
        fireEvent.submit(submitBtn!.closest('form')!);

        await waitFor(() => {
            expect(screen.getByText('كلمة المرور غير متطابقة')).toBeInTheDocument();
        });
    });

    it('handles successful registration', async () => {
        renderWithRouter(<AuthModal isOpen={true} onClose={mockOnClose} initialMode="register" />);

        const nameInput = screen.getByPlaceholderText('مثال: أحمد محمد');
        const phoneInput = screen.getByPlaceholderText('09xxxxxxxx');
        const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
        const confirmInput = screen.getAllByPlaceholderText('••••••••')[1];

        fireEvent.change(nameInput, { target: { value: 'Test User' } });
        fireEvent.change(phoneInput, { target: { value: '0912345678' } });
        fireEvent.change(passwordInput, { target: { value: 'validPass123' } });
        fireEvent.change(confirmInput, { target: { value: 'validPass123' } });

        const form = screen.getAllByRole('button', { name: /إنشاء الحساب/i }).find(btn => btn.closest('form'))!.closest('form')!;
        fireEvent.submit(form);

        await waitFor(() => {
            expect(mockRegister).toHaveBeenCalledWith('0912345678', 'validPass123', 'Test User');
            expect(mockOnClose).toHaveBeenCalled();
        });
    });
});
