import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ArticlesByCategorySection from './ArticlesByCategorySection';
import { useArticles } from '../../hooks/useArticles';
import { BrowserRouter } from 'react-router-dom';

// Mock the hook
vi.mock('../../hooks/useArticles', () => ({
    useArticles: vi.fn(),
}));

const mockArticles = [
    {
        id: '1',
        title: 'Article 1',
        excerpt: 'Excerpt 1',
        cover_image: 'img1.png',
        publication_date: new Date().toISOString(),
        author: 'Author 1',
        tags: ['طب الأسنان'],
    },
    {
        id: '2',
        title: 'Article 2',
        excerpt: 'Excerpt 2',
        cover_image: 'img2.png',
        publication_date: new Date().toISOString(),
        author: 'Author 2',
        tags: ['طب الأسنان'],
    },
];

describe('ArticlesByCategorySection', () => {
    // Mock IntersectionObserver
    const mockIntersectionObserver = vi.fn();
    mockIntersectionObserver.mockReturnValue({
        observe: () => null,
        unobserve: () => null,
        disconnect: () => null
    });
    window.IntersectionObserver = mockIntersectionObserver;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    const renderWithRouter = (ui: React.ReactElement) => {
        return render(<BrowserRouter>{ui}</BrowserRouter>);
    };

    it('renders a sentinel div initially when not priority and not intersected', () => {
        (useArticles as ReturnType<typeof vi.fn>).mockReturnValue({
            data: [],
            isLoading: false,
        });

        const { container } = renderWithRouter(<ArticlesByCategorySection tag="طب الأسنان" />);
        // Sentinel div should be rendered
        expect(container.firstChild).toHaveClass('min-h-[100px]');
        // useArticles should be called with undefined since it's not visible
        expect(useArticles).toHaveBeenCalledWith(undefined);
    });

    it('renders skeletons when priority is true and loading is true', () => {
        (useArticles as ReturnType<typeof vi.fn>).mockReturnValue({
            data: null,
            isLoading: true,
        });

        const { container } = renderWithRouter(<ArticlesByCategorySection tag="طب الأسنان" isPriority={true} />);

        // It should render skeleton divs (className containing "skeleton")
        const skeletons = container.querySelectorAll('.skeleton');
        expect(skeletons.length).toBeGreaterThan(0);
        // It fetches data for the tag
        expect(useArticles).toHaveBeenCalledWith({ tag: 'طب الأسنان', limit: 5 });
    });

    it('renders null when articles length is 0 and it is visible', () => {
        (useArticles as ReturnType<typeof vi.fn>).mockReturnValue({
            data: { data: [] }, // Response could be { data: [] }
            isLoading: false,
        });

        const { container } = renderWithRouter(<ArticlesByCategorySection tag="طب الأسنان" isPriority={true} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders articles and calls onItemsLoaded when visible with data', () => {
        const onItemsLoaded = vi.fn();
        (useArticles as ReturnType<typeof vi.fn>).mockReturnValue({
            data: { data: mockArticles }, // Testing the unwrapping raw.data
            isLoading: false,
        });

        renderWithRouter(<ArticlesByCategorySection tag="طب الأسنان" isPriority={true} onItemsLoaded={onItemsLoaded} />);

        // Ensure articles are rendered
        expect(screen.getAllByText('Article 1').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Article 2').length).toBeGreaterThan(0);

        // Ensure onItemsLoaded was called
        expect(onItemsLoaded).toHaveBeenCalledWith(mockArticles);
    });

    it('filters out excludeIds', () => {
        (useArticles as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockArticles, // Testing unwrapping array directly
            isLoading: false,
        });

        renderWithRouter(<ArticlesByCategorySection tag="طب الأسنان" isPriority={true} excludeIds={['1']} />);

        // Article 2 should be in document, but Article 1 should not
        expect(screen.getAllByText('Article 2').length).toBeGreaterThan(0);
        expect(screen.queryAllByText('Article 1').length).toBe(0);
    });

    it('triggers visibility and fetches data on intersection', () => {
        (useArticles as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockArticles,
            isLoading: false,
        });

        let triggerIntersection: (entries: any[]) => void = () => { };

        window.IntersectionObserver = vi.fn().mockImplementation((callback) => {
            triggerIntersection = callback;
            return {
                observe: vi.fn(),
                disconnect: vi.fn(),
                unobserve: vi.fn(),
            };
        });

        renderWithRouter(<ArticlesByCategorySection tag="طب الأسنان" isPriority={false} />);

        // Not visible initially
        expect(useArticles).toHaveBeenCalledWith(undefined);

        act(() => {
            triggerIntersection([{ isIntersecting: true }]);
        });

        // After intersection, it re-renders and should fetch using useArticles
        expect(useArticles).toHaveBeenCalledWith({ tag: 'طب الأسنان', limit: 5 });
        expect(screen.getAllByText('Article 1').length).toBeGreaterThan(0);
    });
});
