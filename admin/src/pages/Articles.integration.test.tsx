import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Articles from './Articles';
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

describe('Articles page integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads articles and filters by search term', async () => {
    const articles = [
      {
        id: '1',
        title: 'تقويم الأسنان للأطفال',
        author: 'د. ليلى',
        excerpt: 'مقال عن التقويم',
        tags: ['تقويم'],
        cover_image: '/cover.jpg',
        is_featured: true,
        publication_date: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'زراعة الأسنان الحديثة',
        author: 'د. خالد',
        excerpt: 'تقنيات الزراعة',
        tags: ['زراعة'],
        cover_image: '/cover-2.jpg',
        is_featured: false,
        publication_date: new Date().toISOString(),
      },
    ];

    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url, config) => {
      const search = config?.params?.search;
      if (search) {
        return Promise.resolve({
          data: {
            data: articles.filter(a => a.title.includes(search)),
            pagination: { total: 1 }
          }
        });
      }
      return Promise.resolve({
        data: {
          data: articles,
          pagination: { total: 2 }
        }
      });
    });

    vi.useFakeTimers();

    render(
      <MemoryRouter initialEntries={['/articles']}>
        <Articles />
      </MemoryRouter>
    );

    vi.advanceTimersByTime(500); // Trigger initial fetch debounce

    expect(await screen.findByText('تقويم الأسنان للأطفال')).toBeDefined();
    expect(screen.getByText('إجمالي 2 مقال')).toBeDefined();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const searchInput = screen.getByPlaceholderText(/البحث في المقالات/);
    await user.type(searchInput, 'زراعة');

    vi.advanceTimersByTime(500); // Trigger search fetch debounce

    await waitFor(() => {
      expect(screen.getByText('عرض 1 من أصل 2 مقال')).toBeDefined();
    });
    expect(screen.getByText('زراعة الأسنان الحديثة')).toBeDefined();
    expect(screen.queryByText('تقويم الأسنان للأطفال')).toBeNull();
  });
});
