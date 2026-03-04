import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ArticleList from './ArticleList';
import { articlesApi } from '../../lib/api';

const renderWithProviders = (ui: React.ReactElement, initialEntry = '/articles') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ArticleList integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders articles and supports search + tag filters', async () => {
    const articles = [
      {
        id: 'a1',
        title: 'دليل تقويم الأسنان',
        excerpt: 'مقدمة عن تقويم الأسنان',
        cover_image: '/cover.jpg',
        publication_date: new Date().toISOString(),
        author: 'د. سارة',
        tags: ['تقويم', 'أسنان'],
      },
      {
        id: 'a2',
        title: 'زراعة الأسنان الحديثة',
        excerpt: 'تقنيات الزراعة',
        cover_image: '/cover-2.jpg',
        publication_date: new Date().toISOString(),
        author: 'د. عمر',
        tags: ['زراعة'],
      },
    ];

    const getAllSpy = vi.spyOn(articlesApi, 'getAll').mockResolvedValue({
      data: articles,
      pagination: { total: 2 },
    });

    renderWithProviders(<ArticleList />, '/articles?search=تقويم');

    expect(await screen.findByText('دليل تقويم الأسنان')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('ابحث عن مقالات...') as HTMLInputElement;
    expect(searchInput.value).toBe('تقويم');
    expect(screen.getByText('البحث: "تقويم"')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /تصفية/ }));

    await user.click(screen.getByRole('button', { name: 'تقويم' }));
    expect(await screen.findByText('الموضوع: تقويم')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /مسح/ }));
    await waitFor(() => {
      const refreshedInput = screen.getByPlaceholderText('ابحث عن مقالات...') as HTMLInputElement;
      expect(refreshedInput.value).toBe('');
      expect(screen.queryByText('البحث: "تقويم"')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getAllSpy).toHaveBeenCalled();
    });
  });
});
