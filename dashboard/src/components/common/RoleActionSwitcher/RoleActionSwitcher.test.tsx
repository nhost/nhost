import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import RoleActionSwitcher from '@/components/common/RoleActionSwitcher/RoleActionSwitcher';
import { render, screen } from '@/tests/testUtils';

interface RenderSwitcherOptions {
  actionDisabled?: boolean;
  isDirty?: boolean;
  onRoleChange?: (role: string) => void;
  onActionChange?: (action: 'insert' | 'select') => void;
}

function renderSwitcher({
  actionDisabled,
  isDirty = false,
  onRoleChange = vi.fn(),
  onActionChange = vi.fn(),
}: RenderSwitcherOptions = {}) {
  render(
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA attribute.
    <RoleActionSwitcher
      role="user"
      action="select"
      availableRoles={['user', 'editor']}
      availableActions={['select', 'insert']}
      actionLabels={{ select: 'Select', insert: 'Insert' }}
      actionDisabled={actionDisabled}
      isDirty={isDirty}
      onRoleChange={onRoleChange}
      onActionChange={onActionChange}
    />,
  );
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
});

describe('RoleActionSwitcher', () => {
  it('keeps the action switcher operable by default', async () => {
    const user = userEvent.setup();
    const onActionChange = vi.fn();
    renderSwitcher({ onActionChange });

    const action = screen.getByRole('combobox', { name: 'Action:' });
    expect(action).toHaveTextContent('Select');
    expect(action).toBeEnabled();

    action.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');

    expect(onActionChange).toHaveBeenCalledWith('insert');
  });

  it('shows a disabled action without opening or changing it', async () => {
    const user = userEvent.setup();
    const onActionChange = vi.fn();
    renderSwitcher({ actionDisabled: true, onActionChange });

    const action = screen.getByRole('combobox', { name: 'Action:' });
    expect(action).toHaveTextContent('Select');
    expect(action).toBeDisabled();

    await user.click(action);
    action.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');

    expect(
      screen.queryByRole('option', { name: 'Insert' }),
    ).not.toBeInTheDocument();
    expect(onActionChange).not.toHaveBeenCalled();
  });

  it('allows keyboard role switching when the action is disabled', async () => {
    const user = userEvent.setup();
    const onRoleChange = vi.fn();
    renderSwitcher({ actionDisabled: true, onRoleChange });

    const role = screen.getByRole('combobox', { name: 'Role:' });
    role.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');

    expect(onRoleChange).toHaveBeenCalledWith('editor');
  });

  it('guards dirty role switching until discard is confirmed', async () => {
    const user = userEvent.setup();
    const onRoleChange = vi.fn();
    renderSwitcher({ actionDisabled: true, isDirty: true, onRoleChange });

    await user.click(screen.getByRole('combobox', { name: 'Role:' }));
    await user.click(screen.getByRole('option', { name: 'editor' }));

    expect(onRoleChange).not.toHaveBeenCalled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onRoleChange).toHaveBeenCalledWith('editor');
  });
});
