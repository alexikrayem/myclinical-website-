import { Page, Locator } from '@playwright/test';

export class ArticleFormPage {
  readonly page: Page;
  readonly titleInput: Locator;
  readonly authorSelect: Locator;
  readonly excerptInput: Locator;
  readonly contentEditor: Locator;
  readonly imageUrlOption: Locator;
  readonly imageUrlInput: Locator;
  readonly creditsInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.titleInput = page.getByTestId('article-title');
    this.authorSelect = page.getByTestId('article-author');
    this.excerptInput = page.getByTestId('article-excerpt');
    this.contentEditor = page.locator('[data-testid="article-content"] .ql-editor');
    this.imageUrlOption = page.getByTestId('article-image-url-option');
    this.imageUrlInput = page.getByTestId('article-cover-url');
    this.creditsInput = page.getByTestId('article-credits');
    this.submitButton = page.getByTestId('article-submit');
  }

  async fillBasicInfo(title: string, excerpt: string) {
    await this.titleInput.fill(title);
    await this.excerptInput.fill(excerpt);
  }

  async selectAuthor(name: string) {
    await this.authorSelect.selectOption({ label: name });
  }

  async fillContent(htmlText: string) {
    await this.contentEditor.waitFor();
    await this.contentEditor.click();
    await this.contentEditor.fill(htmlText);
  }

  async useCoverImageUrl(url: string) {
    await this.imageUrlOption.check();
    await this.imageUrlInput.fill(url);
  }

  async selectCategory(category: string) {
    await this.page.getByTestId(`article-tag-${encodeURIComponent(category)}`).check();
  }

  async setCredits(value: string) {
    await this.creditsInput.fill(value);
  }

  async submit() {
    await this.submitButton.click();
  }
}
