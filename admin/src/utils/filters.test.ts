import { describe, it, expect } from 'vitest';
import { filterArticles, filterAuthors } from './filters';

describe('filterArticles', () => {
  it('returns the original list when search is empty', () => {
    const articles = [{ title: 'A' }, { title: 'B' }];
    const result = filterArticles(articles, '   ');

    expect(result).toBe(articles);
  });

  it('matches against title, author, excerpt, and tags', () => {
    const articles = [
      { title: 'Dental Tips', author: 'Dr. Lina', excerpt: 'Healthy gums', tags: ['Oral', 'Care'] },
      { title: 'Braces Guide', author: 'Dr. Sam', excerpt: 'Aligners', tags: ['Orthodontics'] },
    ];

    expect(filterArticles(articles, 'lina')).toEqual([articles[0]]);
    expect(filterArticles(articles, 'orth')).toEqual([articles[1]]);
    expect(filterArticles(articles, 'gums')).toEqual([articles[0]]);
    expect(filterArticles(articles, 'care')).toEqual([articles[0]]);
  });
});

describe('filterAuthors', () => {
  it('returns the original list when search is empty', () => {
    const authors = [{ name: 'A' }, { name: 'B' }];
    const result = filterAuthors(authors, '');

    expect(result).toBe(authors);
  });

  it('matches against name, specialization, and location', () => {
    const authors = [
      { name: 'Sara Ali', specialization: 'Implants', location: 'Riyadh' },
      { name: 'Omar Noor', specialization: 'Pediatric', location: 'Jeddah' },
    ];

    expect(filterAuthors(authors, 'sara')).toEqual([authors[0]]);
    expect(filterAuthors(authors, 'ped')).toEqual([authors[1]]);
    expect(filterAuthors(authors, 'riy')).toEqual([authors[0]]);
  });
});
