
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FeaturedArticles from './FeaturedArticles';
import { useAllFeaturedContent } from '../../hooks/useArticles';
import { useNavigate } from 'react-router-dom';

// Mock dependencies
vi.mock('../../hooks/useArticles', () => ({
    useAllFeaturedContent: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: vi.fn(),
}));

const mockArticles = [
    {
        id: '1',
        title: 'First Article',
        excerpt: 'Excerpt 1',
        author: 'Author 1',
        type: 'article',
        cover_image: 'image1.jpg',
        publication_date: new Date().toISOString(),
        path: '/articles/1',
    },
    {
        id: '2',
        title: 'Second Article',
        excerpt: 'Excerpt 2',
        author: 'Author 2',
        type: 'clinical_case',
        cover_image: 'image2.jpg',
        publication_date: new Date().toISOString(),
        path: '/cases/2',
    },
];

describe('FeaturedArticles', () => {
    const mockNavigate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('renders loading state initially', () => {
        (useAllFeaturedContent as ReturnType<typeof vi.fn>).mockReturnValue({
            data: [],
            isLoading: true,
        });
        render(<FeaturedArticles />);
        expect(screen.getByText('جاري تحضير المحتوى المميز...')).toBeInTheDocument();
    });

    it('renders empty state if no articles available', () => {
        (useAllFeaturedContent as ReturnType<typeof vi.fn>).mockReturnValue({
            data: [],
            isLoading: false,
        });
        render(<FeaturedArticles />);
        expect(screen.getByText('لا توجد مقالات مميزة متاحة حالياً')).toBeInTheDocument();
    });

    it('renders articles and authors list', () => {
        (useAllFeaturedContent as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockArticles,
            isLoading: false,
        });
        render(<FeaturedArticles />);
        // Title renders in two places: the hero <h2> and the sidebar subtitle div.
        // getAllByText avoids the "Found multiple elements" error.
        expect(screen.getAllByText('First Article').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Second Article').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Author 1')).toBeInTheDocument();
        expect(screen.getByText('Author 2')).toBeInTheDocument();
    });

    it('calls onItemsLoaded when articles are present', () => {
        const onItemsLoaded = vi.fn();
        (useAllFeaturedContent as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockArticles,
            isLoading: false,
        });
        render(<FeaturedArticles onItemsLoaded={onItemsLoaded} />);
        expect(onItemsLoaded).toHaveBeenCalledWith(mockArticles);
    });

    it('navigates to article when clicking read button', () => {
        (useAllFeaturedContent as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockArticles,
            isLoading: false,
        });
        render(<FeaturedArticles />);

        // Both slides render "اقرأ المقال كاملاً" but only the first (index 0) is
        // pointer-events-auto (active). Click the first match.
        const readButtons = screen.getAllByText('اقرأ المقال كاملاً');
        fireEvent.click(readButtons[0]);
        expect(mockNavigate).toHaveBeenCalledWith('/articles/1');
    });

    it('rotates to next article automatically', () => {
        (useAllFeaturedContent as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockArticles,
            isLoading: false,
        });
        render(<FeaturedArticles />);

        act(() => {
            vi.advanceTimersByTime(6000);
        });

        // We can test active index UI change via "حالة سريرية" which applies to article 2
        // but both are in DOM. Let's look for button text.
        // The second article is type: 'clinical_case', so its text is 'اقرأ المقال كاملاً' but first article is not visible depending on the index.
        // Given DOM structure has them changing opacity based on index, we can at least expect the timer ran.
        // A more precise test would check for classes, but we know Next is article 2.
        // So let's check if the specific author has the active classes.
        const author2Container = screen.getByText('Author 2').closest('button');
        expect(author2Container?.className).toContain('bg-white'); // Active state class
    });

    it('stops rotating on hover', () => {
        (useAllFeaturedContent as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockArticles,
            isLoading: false,
        });
        const { container } = render(<FeaturedArticles />);

        const rootDiv = container.firstChild as HTMLElement;
        fireEvent.mouseEnter(rootDiv);

        act(() => {
            vi.advanceTimersByTime(6000);
        });

        // Should still be on the first article
        const author1Container = screen.getByText('Author 1').closest('button');
        expect(author1Container?.className).toContain('bg-white');
    });

    it('changes article when author is clicked', () => {
        (useAllFeaturedContent as ReturnType<typeof vi.fn>).mockReturnValue({
            data: mockArticles,
            isLoading: false,
        });
        render(<FeaturedArticles />);

        // Click second author
        const author2Button = screen.getByText('Author 2').closest('button')!;
        fireEvent.click(author2Button);

        // It should become active
        expect(author2Button.className).toContain('bg-white');
    });
});
