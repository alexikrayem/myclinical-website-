import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Authors from './Authors';
import { api } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
  },
  useAuth: () => ({
    user: { email: 'admin@example.com' },
    logout: vi.fn(),
  }),
}));

describe('Authors page integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads authors and filters by search term', async () => {
    const authors = [
      {
        id: '1',
        name: 'د. مريم',
        specialization: 'تقويم',
        location: 'الرياض',
        email: 'mariam@example.com',
        website: 'https://example.com',
        image: '/avatar.jpg',
      },
      {
        id: '2',
        name: 'د. فهد',
        specialization: 'زراعة',
        location: 'جدة',
        email: 'fahd@example.com',
        website: 'https://example.org',
        image: '/avatar-2.jpg',
      },
    ];

    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: authors });

    render(
      <MemoryRouter initialEntries={['/authors']}>
        <Authors />
      </MemoryRouter>
    );

    expect(await screen.findByText('د. مريم')).toBeInTheDocument();
    expect(screen.getByText('إجمالي 2 مؤلف')).toBeInTheDocument();

    const user = userEvent.setup();
    const searchInput = screen.getByPlaceholderText(/البحث في المؤلفين/);
    await user.type(searchInput, 'جدة');

    expect(await screen.findByText('عرض 1 من أصل 2 مؤلف')).toBeInTheDocument();
    expect(screen.getByText('د. فهد')).toBeInTheDocument();
    expect(screen.queryByText('د. مريم')).not.toBeInTheDocument();
  });
});
