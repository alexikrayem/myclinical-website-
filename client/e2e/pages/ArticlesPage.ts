import { Page, Locator } from '@playwright/test';

export class ArticlesPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly filterToggle: Locator;
  readonly clearButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByTestId('articles-search-input');
    this.filterToggle = page.getByTestId('articles-filter-toggle');
    this.clearButton = page.getByTestId('articles-clear');
  }

  async goto() {
    await this.page.goto('/articles');
  }

  async search(term: string) {
    await this.searchInput.fill(term);
  }

  async clearSearch() {
    await this.clearButton.click();
  }

  async toggleFilters() {
    await this.filterToggle.click();
  }

  async selectTag(tag: string) {
    await this.page.getByTestId(`tag-filter-${encodeURIComponent(tag)}`).click();
  }

  articleTitle(title: string) {
    return this.page.getByRole('heading', { name: title });
  }
}
