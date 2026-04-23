import { test as base } from '@playwright/test';

export type AdminUser = {
  email: string;
  password: string;
};

export type Article = {
  id: string;
  title: string;
  author: string;
  excerpt: string;
  tags: string[];
  cover_image: string;
  is_featured: boolean;
  publication_date: string;
};

type Fixtures = {
  adminUser: AdminUser;
  articles: Article[];
};

export const test = base.extend<Fixtures>({
  adminUser: async (_fixtures, applyFixture) => {
    await applyFixture({
      email: 'admin@arabdental.com',
      password: 'Admin123!',
    });
  },
  articles: async (_fixtures, applyFixture) => {
    await applyFixture([
      {
        id: '1',
        title: 'تقويم الأسنان للأطفال',
        author: 'د. ليلى',
        excerpt: 'مقال عن التقويم',
        tags: ['تقويم'],
        cover_image: '/cover.jpg',
        is_featured: true,
        publication_date: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'زراعة الأسنان الحديثة',
        author: 'د. خالد',
        excerpt: 'تقنيات الزراعة',
        tags: ['زراعة'],
        cover_image: '/cover-2.jpg',
        is_featured: false,
        publication_date: new Date().toISOString(),
      },
    ]);
  },
});

export { expect } from '@playwright/test';
