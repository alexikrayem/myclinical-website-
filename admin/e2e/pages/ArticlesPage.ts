import { Page, Locator } from '@playwright/test';

export class ArticlesPage {
  readonly page: Page;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByTestId('admin-articles-search');
  }

  async gotoFromSidebar() {
    await this.page.getByTestId('sidebar-link-articles').click();
  }

  async search(term: string) {
    await this.searchInput.fill(term);
  }

  articleRowTitle(title: string) {
    return this.page.getByText(title);
  }
}
