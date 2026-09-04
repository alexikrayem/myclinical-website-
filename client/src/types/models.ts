export interface User {
    id: string;
    phone_number: string;
    display_name?: string;
    role: 'admin' | 'user';
    created_at?: string;
    updated_at?: string;
}

export interface Article {
    id: string;
    title: string;
    excerpt: string;
    content?: string;
    cover_image?: string;
    author: string;
    author_image?: string | null;
    article_type: string;
    is_featured?: boolean;
    tags?: string[];
    publication_date?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Course {
    id: string;
    title: string;
    description?: string;
    excerpt?: string;
    thumbnail_url?: string;
    cover_image?: string;
    instructor?: { name: string; avatar_url: string };
    author?: string;
    created_at?: string;
    published_at?: string;
    categories?: string[];
    is_featured?: boolean;
}

export interface Research {
    id: string;
    title: string;
    abstract?: string;
    excerpt?: string;
    journal_name?: string;
    /** Field name returned by the backend API (alias for journal_name). */
    journal?: string;
    /** Authors may arrive as a pre-joined string or as an array. */
    authors?: string | string[];
    publication_date?: string;
    url?: string;
    created_at?: string;
}

export interface FeaturedContent {
    id: string;
    title: string;
    excerpt: string;
    author: string;
    author_image?: string | null;
    cover_image?: string | null;
    publication_date?: string;
    type: string;
    path: string;
    date: number;
}
