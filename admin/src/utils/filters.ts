const includesTerm = (value: unknown, term: string) =>
  typeof value === 'string' && value.toLowerCase().includes(term);

export interface ArticleSearchable {
  title?: string;
  author?: string;
  excerpt?: string;
  tags?: string[];
}

export interface AuthorSearchable {
  name?: string;
  specialization?: string;
  location?: string;
}

export const filterArticles = (articles: ArticleSearchable[], searchTerm: string) => {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return articles;

  return articles.filter((article) => {
    return (
      includesTerm(article.title, term) ||
      includesTerm(article.author, term) ||
      includesTerm(article.excerpt, term) ||
      (Array.isArray(article.tags) && article.tags.some((tag) => includesTerm(tag, term)))
    );
  });
};

export const filterAuthors = (authors: AuthorSearchable[], searchTerm: string) => {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return authors;

  return authors.filter((author) => {
    return (
      includesTerm(author.name, term) ||
      includesTerm(author.specialization, term) ||
      includesTerm(author.location, term)
    );
  });
};
