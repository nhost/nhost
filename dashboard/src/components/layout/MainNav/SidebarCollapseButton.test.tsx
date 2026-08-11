import { vi } from 'vitest';

import SidebarCollapseButton from '@/components/layout/MainNav/SidebarCollapseButton';
import { fireEvent, render, screen } from '@/tests/testUtils';

it('renders the expand action and handles clicks', () => {
  const onClick = vi.fn();

  render(<SidebarCollapseButton expanded={false} onClick={onClick} />);

  const button = screen.getByRole('button', { name: 'Expand sidebar' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(button).toHaveClass('h-8', 'w-8');

  fireEvent.click(button);

  expect(onClick).toHaveBeenCalledOnce();
});

it('renders the collapse action when the sidebar is expanded', () => {
  render(<SidebarCollapseButton expanded onClick={vi.fn()} />);

  expect(
    screen.getByRole('button', { name: 'Collapse sidebar' }),
  ).toHaveAttribute('aria-expanded', 'true');
});
