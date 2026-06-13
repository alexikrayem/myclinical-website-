export type GlobalSearchType = 'article' | 'research' | 'course';

export interface GlobalSearchResult {
    id: string;
    title: string;
    type: GlobalSearchType;
    slug?: string;
    [key: string]: unknown;
}

export interface PaginatedResponse<T> {
    data: T[];
    total?: number;
    page?: number;
    limit?: number;
}
