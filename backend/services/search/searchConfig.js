export const SEARCH_INDEXES = {
  articles: {
    name: 'articles',
    primaryKey: 'id',
    settings: {
      searchableAttributes: [
        'title_normalized',
        'excerpt_normalized',
        'content_normalized',
        'author_normalized',
        'tags_normalized'
      ],
      filterableAttributes: ['tags', 'article_type', 'is_featured'],
      sortableAttributes: ['publication_date'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'exactness',
        'sort',
        'desc(publication_date)'
      ],
      synonyms: {},
      stopWords: []
    }
  },
  researches: {
    name: 'researches',
    primaryKey: 'id',
    settings: {
      searchableAttributes: [
        'title_normalized',
        'abstract_normalized',
        'journal_normalized',
        'authors_normalized'
      ],
      filterableAttributes: ['journal'],
      sortableAttributes: ['publication_date'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'exactness',
        'sort',
        'desc(publication_date)'
      ],
      synonyms: {},
      stopWords: []
    }
  },
  courses: {
    name: 'courses',
    primaryKey: 'id',
    settings: {
      searchableAttributes: [
        'title_normalized',
        'description_normalized',
        'author_normalized',
        'categories_normalized'
      ],
      filterableAttributes: ['categories', 'is_featured', 'level'],
      sortableAttributes: ['publication_date', 'rating'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'exactness',
        'sort',
        'desc(publication_date)'
      ],
      synonyms: {},
      stopWords: []
    }
  }
};

export const SEARCH_TYPE_WEIGHTS = {
  articles: 1.0,
  researches: 1.05,
  courses: 0.95
};

export const MERGED_FETCH_CAP = 200;
