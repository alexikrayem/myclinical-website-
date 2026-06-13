import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HomePage from './HomePage';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('../hooks/useArticles', () => ({
    useTags: vi.fn(() => ({ data: ['زراعة', 'تقويم', 'جراحة'] }))
}));

vi.mock('../hooks/useUserSpecialties', () => ({
    useUserSpecialties: vi.fn(() => ({
        specialties: ['زراعة'],
        save: vi.fn()
    }))
}));

vi.mock('../hooks/useDisplayedItems', () => ({
    useDisplayedItems: vi.fn(() => ({
        displayedIds: new Set(['1', '2']),
        addIds: vi.fn()
    }))
}));

// Mock child components to verify they are rendered with correct props
vi.mock('../components/article/FeaturedArticles', () => ({
    default: ({ onItemsLoaded }: any) => <div data-testid="featured-articles" onClick={() => onItemsLoaded([{ id: '3' }])}>FeaturedArticles</div>
}));

vi.mock('../components/article/ArticleList', () => ({
    default: () => <div data-testid="article-list">ArticleList</div>
}));

vi.mock('../components/home/RotatingDentalImages', () => ({
    default: () => <div data-testid="rotating-dental-images">RotatingDentalImages</div>
}));

vi.mock('../components/home/SpecialtySelector', () => ({
    // Testing saving specialties
    default: ({ onSave }: any) => <div data-testid="specialty-selector" onClick={() => onSave(['تقويم'])}>SpecialtySelector</div>
}));

vi.mock('../components/home/ArticlesByCategorySection', () => ({
    // Will throw test ID with tag to verify order
    default: ({ tag, isPriority }: any) => <div data-testid={`category-section-${tag}`} data-priority={isPriority}>Category: {tag}</div>
}));

vi.mock('../components/home/LatestResearchSection', () => ({
    default: () => <div data-testid="latest-research">LatestResearchSection</div>
}));

vi.mock('../components/home/HeroCarousel', () => ({
    default: () => <div data-testid="hero-carousel">HeroCarousel</div>
}));

describe('HomePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock IntersectionObserver if any un-mocked child component needs it
        const mockIntersectionObserver = vi.fn();
        mockIntersectionObserver.mockReturnValue({
            observe: () => null,
            unobserve: () => null,
            disconnect: () => null
        });
        window.IntersectionObserver = mockIntersectionObserver;
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    const renderPage = () => {
        return render(<BrowserRouter><HomePage /></BrowserRouter>);
    };

    it('renders all major sections', () => {
        renderPage();

        expect(screen.getByTestId('hero-carousel')).toBeInTheDocument();
        expect(screen.getByTestId('rotating-dental-images')).toBeInTheDocument();
        expect(screen.getByTestId('featured-articles')).toBeInTheDocument();
        expect(screen.getByTestId('article-list')).toBeInTheDocument();
        expect(screen.getByTestId('latest-research')).toBeInTheDocument();
        expect(screen.getByTestId('specialty-selector')).toBeInTheDocument();
    });

    it('renders category sections with priority given to user specialties', () => {
        renderPage();

        // Tags are rendered as links in the Categories Section map
        expect(screen.getByText('زراعة')).toBeInTheDocument();
        expect(screen.getByText('تقويم')).toBeInTheDocument();
        expect(screen.getByText('جراحة')).toBeInTheDocument();

        // ArticlesByCategorySection rendered for each tag
        const ziraaSection = screen.getByTestId('category-section-زراعة');
        expect(ziraaSection).toBeInTheDocument();
        expect(ziraaSection).toHaveAttribute('data-priority', 'true'); // Because it is in user specialties

        const taqwimSection = screen.getByTestId('category-section-تقويم');
        expect(taqwimSection).toBeInTheDocument();
        expect(taqwimSection).toHaveAttribute('data-priority', 'false'); // Because it's not in user specialties
    });
});
