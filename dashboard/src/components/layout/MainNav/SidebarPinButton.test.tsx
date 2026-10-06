import { vi } from 'vitest';
import SidebarPinButton from '@/components/layout/MainNav/SidebarPinButton';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

it('renders the pin action and handles clicks', async () => {
  const user = new TestUserEvent();
  const onClick = vi.fn();

  render(<SidebarPinButton pinned={false} onClick={onClick} />);

  const button = screen.getByRole('button', { name: 'Pin sidebar' });
  expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(button).toHaveClass('h-8', 'w-8');

  await user.click(button);

  expect(onClick).toHaveBeenCalledOnce();
});

it('renders the unpin action when the sidebar is pinned', () => {
  render(<SidebarPinButton pinned onClick={vi.fn()} />);

  expect(screen.getByRole('button', { name: 'Unpin sidebar' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
