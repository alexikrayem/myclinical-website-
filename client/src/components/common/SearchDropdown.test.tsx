import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SearchDropdown from './SearchDropdown';

describe('SearchDropdown', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <MemoryRouter>
        <SearchDropdown results={[]} loading={false} isOpen={false} onClose={() => {}} searchTerm="بحث" />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders results and triggers onClose when a result is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const results = [
      { id: '1', title: 'مقال تجريبي', type: 'article', author: 'د. أحمد', slug: 'sample-article' },
      { id: 'r1', title: 'بحث علمي', type: 'research', journal: 'مجلة الأسنان' },
    ];

    render(
      <MemoryRouter>
        <SearchDropdown
          results={results}
          loading={false}
          isOpen={true}
          onClose={onClose}
          searchTerm="أسنان"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('نتائج البحث المقترحة')).toBeInTheDocument();
    expect(screen.getByText('مقال')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'بحث علمي' })).toBeInTheDocument();
    expect(screen.getByText('عرض كل النتائج لـ "أسنان"')).toBeInTheDocument();

    const titleNode = screen.getByText('مقال تجريبي');
    const link = titleNode.closest('a');
    expect(link).not.toBeNull();

    await user.click(link as HTMLAnchorElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
