/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable no-empty-pattern */
import { test as base } from '@playwright/test';
import { createTestArticle, deleteByIds, isE2EEnvReady } from './seed';

export type Article = {
  id: string;
  title: string;
  excerpt: string;
  cover_image: string;
  publication_date: string;
  author: string;
  tags: string[];
};

type Fixtures = {
  articles: Article[];
};

export const test = base.extend<Fixtures>({
  articles: async ({ }, use) => {
    const useMocks = process.env.E2E_USE_MOCKS === '1' || !isE2EEnvReady();

    if (useMocks) {
      await use([
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
      ]);
      return;
    }

    const created = [
      await createTestArticle({
        title: 'دليل تقويم الأسنان',
        excerpt: 'مقدمة عن تقويم الأسنان',
        author: 'د. سارة',
        tags: ['تقويم', 'أسنان'],
      }),
      await createTestArticle({
        title: 'زراعة الأسنان الحديثة',
        excerpt: 'تقنيات الزراعة',
        author: 'د. عمر',
        tags: ['زراعة'],
      }),
    ];

    try {
      await use(created);
    } finally {
      await deleteByIds('articles', created.map((item) => item.id));
    }
  },
});

export { expect } from '@playwright/test';
