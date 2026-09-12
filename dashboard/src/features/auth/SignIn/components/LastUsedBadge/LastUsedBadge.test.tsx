import { describe, expect, it } from 'vitest';
import { render, screen } from '@/tests/testUtils';
import { LastUsedBadge } from './LastUsedBadge';

describe('LastUsedBadge', () => {
  it('renders LAST USED text', () => {
    render(<LastUsedBadge />);
    expect(screen.getByText('LAST USED')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    render(<LastUsedBadge className="custom-test-class" />);
    const badge = screen.getByText('LAST USED');
    expect(badge).toHaveClass('custom-test-class');
  });

  it('has pointer-events-none and absolute positioning', () => {
    render(<LastUsedBadge />);
    const badge = screen.getByText('LAST USED');
    expect(badge).toHaveClass('pointer-events-none');
    expect(badge).toHaveClass('absolute');
  });
});
