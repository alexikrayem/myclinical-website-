import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Verifications from './Verifications';
import { api } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  useAuth: () => ({
    user: { email: 'admin@example.com' },
    logout: vi.fn(),
  }),
}));

describe('Verifications page integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const pendingDoctors = [
    {
      id: 'doc-1',
      display_name: 'د. أحمد علي',
      phone_number: '+966500000001',
      role: 'doctor',
      verification_status: 'pending',
      specialization: 'تقويم الأسنان',
      bio: 'أخصائي تقويم أسنان بخبرة 5 سنوات',
      education: 'ماجستير تقويم الأسنان من جامعة الملك سعود',
      experience_years: 5,
      clinic_address: 'عيادات الرياض التخصصية، الرياض',
      email: 'ahmed@example.com',
      website: 'https://dr-ahmed.com',
      created_at: '2026-06-13T12:00:00Z',
    },
  ];

  it('renders empty state when there are no requests', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

    render(
      <MemoryRouter initialEntries={['/verifications']}>
        <Verifications />
      </MemoryRouter>
    );

    expect(await screen.findByText('لا توجد طلبات تحقق معلقة')).toBeInTheDocument();
  });

  it('loads and displays pending verification requests', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: pendingDoctors });

    render(
      <MemoryRouter initialEntries={['/verifications']}>
        <Verifications />
      </MemoryRouter>
    );

    expect(await screen.findByText('د. أحمد علي')).toBeInTheDocument();
    expect(screen.getByText('تقويم الأسنان')).toBeInTheDocument();
    expect(screen.getByText('5 سنوات خبرة')).toBeInTheDocument();
    expect(screen.getByText('1 طلبات معلقة')).toBeInTheDocument();
  });

  it('handles the review, approval and rejection flows', async () => {
    // 1. Mock GET verifications
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url) => {
      if (url === '/admin/verifications') {
        return Promise.resolve({ data: pendingDoctors });
      }
      if (url === '/admin/verifications/doc-1/card') {
        return Promise.resolve({ data: { signedUrl: 'https://supabase.com/signed-card.jpg' } });
      }
      return Promise.reject(new Error('Not found'));
    });

    // 2. Mock POST approve & reject
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, message: 'Operation successful' },
    });

    render(
      <MemoryRouter initialEntries={['/verifications']}>
        <Verifications />
      </MemoryRouter>
    );

    expect(await screen.findByText('د. أحمد علي')).toBeInTheDocument();

    const user = userEvent.setup();
    const reviewBtn = screen.getByTestId('review-button-doc-1');
    
    // Open review modal
    await user.click(reviewBtn);

    // Verify modal elements
    expect(api.get).toHaveBeenCalledWith('/admin/verifications/doc-1/card');
    expect(await screen.findByText('طلب انضمام طبيب')).toBeInTheDocument();
    expect(screen.getByText('أخصائي تقويم أسنان بخبرة 5 سنوات')).toBeInTheDocument();
    expect(screen.getByText('عيادات الرياض التخصصية، الرياض')).toBeInTheDocument();

    // Test rejection toggle
    const rejectBtn = screen.getByTestId('reject-button');
    await user.click(rejectBtn);

    const reasonTextarea = screen.getByTestId('rejection-reason-textarea');
    expect(reasonTextarea).toBeInTheDocument();

    // Enter reason and submit rejection
    await user.type(reasonTextarea, 'الصورة غير واضحة');
    const confirmRejectBtn = screen.getByTestId('confirm-reject-button');
    await user.click(confirmRejectBtn);

    expect(api.post).toHaveBeenCalledWith('/admin/verifications/doc-1/reject', {
      rejection_reason: 'الصورة غير واضحة',
    });
  });
});
