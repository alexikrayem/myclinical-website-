import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  it('renders the requested number of skeleton items', () => {
    const { container } = render(<Skeleton count={3} />);
    expect(container.querySelectorAll('div')).toHaveLength(3);
  });

  it('applies circle preset classes', () => {
    const { container } = render(<Skeleton type="circle" count={1} />);
    const element = container.querySelector('div');
    expect(element).toHaveClass('rounded-full');
  });
});
