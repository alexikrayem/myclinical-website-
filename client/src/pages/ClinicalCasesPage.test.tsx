import { render, screen, act, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ClinicalCasesPage from './ClinicalCasesPage';
import api from '../lib/api';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('../lib/api', () => ({
    default: {
        get: vi.fn(),
    }
}));

vi.mock('../components/article/ArticleCard', () => ({
    default: ({ article }: { article: any }) => <div data-testid={`article-card-${article.id}`}>{article.title}</div>
}));

vi.mock('../components/loaders/ArticleListSkeleton', () => ({
    default: () => <div data-testid="skeleton">Loading...</div>
}));

describe('ClinicalCasesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    const renderWithRouter = () => {
        return render(
            <BrowserRouter>
                <ClinicalCasesPage />
            </BrowserRouter>
        );
    };

    it('renders skeleton initially and fetches data', async () => {
        (api.get as any).mockImplementation((url: string) => {
            if (url === '/articles/tags') return Promise.resolve({ data: ['Tag1', 'Tag2'] });
            if (url === '/articles') return Promise.resolve({ data: { data: [], pagination: { pages: 1 } } });
        });

        renderWithRouter();

        // Before state updates, skeleton is visible
        expect(screen.getByTestId('skeleton')).toBeInTheDocument();

        // Wait for fetch
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/articles/tags');
            expect(api.get).toHaveBeenCalledWith('/articles', expect.objectContaining({
                params: expect.objectContaining({ type: 'clinical_case', page: 1 })
            }));
        });
    });

    it('renders empty state if no cases exist', async () => {
        (api.get as any).mockImplementation((url: string) => {
            if (url === '/articles/tags') return Promise.resolve({ data: [] });
            if (url === '/articles') return Promise.resolve({ data: { data: [], pagination: { pages: 1 } } });
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('لا توجد حالات سريرية')).toBeInTheDocument();
            expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
        });
    });

    it('renders cases and pagination when items are returned', async () => {
        const mockCases = [
            { id: '1', title: 'Case 1' },
            { id: '2', title: 'Case 2' }
        ];

        (api.get as any).mockImplementation((url: string) => {
            if (url === '/articles/tags') return Promise.resolve({ data: [] });
            if (url === '/articles') return Promise.resolve({ data: { data: mockCases, pagination: { pages: 2 } } });
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByTestId('article-card-1')).toBeInTheDocument();
            expect(screen.getByTestId('article-card-2')).toBeInTheDocument();
            expect(screen.getByText('صفحة 1 من 2')).toBeInTheDocument();
            expect(screen.getByText('التالي')).toBeInTheDocument();
        });
    });

    it('debounces search input and triggers new fetch', async () => {
        let isFirstCall = true;
        (api.get as any).mockImplementation((url: string) => {
            if (url === '/articles/tags') return Promise.resolve({ data: [] });
            if (url === '/articles') {
                if (isFirstCall) {
                    isFirstCall = false;
                    return Promise.resolve({ data: { data: [], pagination: { pages: 1 } } });
                }
                return Promise.resolve({ data: { data: [], pagination: { pages: 1 } } });
            }
        });

        renderWithRouter();

        // Wait for initial fetch to settle
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledTimes(2); // 1 tags + 1 articles
        });

        const searchInput = screen.getByPlaceholderText('ابحث عن حالة سريرية...');
        fireEvent.change(searchInput, { target: { value: 'tooth' } });

        // Shouldn't immediately call API (debounced)
        expect(api.get).toHaveBeenCalledTimes(2);

        // Now it should be called again with search query (wait for real timer)
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/articles', expect.objectContaining({
                params: expect.objectContaining({ search: 'tooth', page: 1, type: 'clinical_case' })
            }));
        }, { timeout: 2000 }); // allow 2 seconds to be safe
    });

    it('changes tag selection and fetches again', async () => {
        let callIndex = 0;
        (api.get as any).mockImplementation((url: string) => {
            if (url === '/articles/tags') return Promise.resolve({ data: ['Tag1'] });
            if (url === '/articles') {
                callIndex++;
                if (callIndex === 1) return Promise.resolve({ data: { data: [], pagination: { pages: 1 } } });
                return Promise.resolve({ data: { data: [], pagination: { pages: 1 } } });
            }
        });

        renderWithRouter();

        // Wait for initial fetch to settle
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledTimes(2);
            expect(screen.getByText('Tag1')).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'Tag1' } });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/articles', expect.objectContaining({
                params: expect.objectContaining({ tag: 'Tag1', page: 1, type: 'clinical_case' })
            }));
        }, { timeout: 2000 });
    });
});
