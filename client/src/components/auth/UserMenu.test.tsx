import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import UserMenu from './UserMenu';
import { useAuth } from '../../context/AuthContext';
import { BrowserRouter, useNavigate } from 'react-router-dom';

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: vi.fn(),
    };
});

const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('UserMenu', () => {
    const mockLogout = vi.fn();
    const mockNavigate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
    });

    it('renders login and register links when not authenticated', () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: false,
        });

        renderWithRouter(<UserMenu />);

        expect(screen.getByText('دخول')).toBeInTheDocument();
        expect(screen.getByText('حساب جديد')).toBeInTheDocument();
        expect(screen.queryByTestId('user-menu-button')).not.toBeInTheDocument();
    });

    it('renders user button when authenticated', () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: true,
            user: { display_name: 'Test User' },
        });

        renderWithRouter(<UserMenu />);

        expect(screen.getByTestId('user-menu-button')).toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('opens and closes dropdown on click', () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: true,
            user: { display_name: 'Test User', phone_number: '0912345678' },
            credits: { balance: 10, video_watch_minutes: 20, article_credits: 5 },
        });

        renderWithRouter(<UserMenu />);

        const menuButton = screen.getByTestId('user-menu-button');
        expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument();

        fireEvent.click(menuButton);
        expect(screen.getByTestId('user-menu-dropdown')).toBeInTheDocument();

        // Check user info inside dropdown
        expect(screen.getByTestId('user-menu-phone')).toHaveTextContent('0912345678');

        // Check credits
        expect(screen.getByText('10')).toBeInTheDocument(); // balance
        expect(screen.getByText('20')).toBeInTheDocument(); // video
        expect(screen.getByText('5')).toBeInTheDocument();  // article

        // Clicking again should theoretically be covered by menuButton or backdrop, but our button toggles it
        fireEvent.click(menuButton);
        expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument();
    });

    it('handles logout flow', async () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: true,
            user: { display_name: 'Test User' },
            logout: mockLogout,
        });

        renderWithRouter(<UserMenu />);
        fireEvent.click(screen.getByTestId('user-menu-button'));

        const logoutBtn = screen.getByTestId('user-menu-logout');
        fireEvent.click(logoutBtn);

        await waitFor(() => {
            expect(mockLogout).toHaveBeenCalledTimes(1);
        });
        // Should close dropdown
        expect(screen.queryByTestId('user-menu-dropdown')).not.toBeInTheDocument();
    });

    it('navigates to redeem profile tab when clicking redeem and no prop provided', () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: true,
            user: { display_name: 'Test User' },
        });

        renderWithRouter(<UserMenu />);
        fireEvent.click(screen.getByTestId('user-menu-button'));

        const redeemBtn = screen.getByTestId('user-menu-redeem');
        fireEvent.click(redeemBtn);

        expect(mockNavigate).toHaveBeenCalledWith('/profile?tab=redeem');
    });

    it('calls onRedeemClick prop when clicking redeem if provided', () => {
        (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
            isAuthenticated: true,
            user: { display_name: 'Test User' },
        });

        const mockOnRedeemClick = vi.fn();
        renderWithRouter(<UserMenu onRedeemClick={mockOnRedeemClick} />);
        fireEvent.click(screen.getByTestId('user-menu-button'));

        const redeemBtn = screen.getByTestId('user-menu-redeem');
        fireEvent.click(redeemBtn);

        expect(mockOnRedeemClick).toHaveBeenCalledTimes(1);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
