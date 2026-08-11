import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import useDialog from './useDialog';

const DIRTY_MESSAGE =
  'You have unsaved local changes. Are you sure you want to discard them?';

function TestWrapper() {
  const dialog = useDialog();
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.setDirtySource('a', true, 'drawer')}
      >
        dirty-a-drawer
      </button>
      <button
        type="button"
        onClick={() => dialog.setDirtySource('a', false, 'drawer')}
      >
        clean-a-drawer
      </button>
      <button
        type="button"
        onClick={() => dialog.setDirtySource('b', true, 'drawer')}
      >
        dirty-b-drawer
      </button>
      <button
        type="button"
        onClick={() => dialog.setDirtySource('a', true, 'dialog')}
      >
        dirty-a-dialog
      </button>
      <button
        type="button"
        onClick={(event) => dialog.closeDrawerWithDirtyGuard(event)}
      >
        close-drawer
      </button>
    </>
  );
}

describe('DialogProvider setDirtySource aggregation', () => {
  it('triggers dirty confirmation when one drawer source is dirty on close', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    await user.click(screen.getByRole('button', { name: 'dirty-a-drawer' }));
    await user.click(screen.getByRole('button', { name: 'close-drawer' }));

    await waitFor(() => {
      expect(screen.getByText(DIRTY_MESSAGE)).toBeInTheDocument();
    });
  });

  it('does not trigger confirmation when every drawer source is clean', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    await user.click(screen.getByRole('button', { name: 'dirty-a-drawer' }));
    await user.click(screen.getByRole('button', { name: 'clean-a-drawer' }));
    await user.click(screen.getByRole('button', { name: 'close-drawer' }));

    expect(screen.queryByText(DIRTY_MESSAGE)).not.toBeInTheDocument();
  });

  it('still triggers confirmation when one of two dirty drawer sources is cleaned', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    await user.click(screen.getByRole('button', { name: 'dirty-a-drawer' }));
    await user.click(screen.getByRole('button', { name: 'dirty-b-drawer' }));
    await user.click(screen.getByRole('button', { name: 'clean-a-drawer' }));
    await user.click(screen.getByRole('button', { name: 'close-drawer' }));

    await waitFor(() => {
      expect(screen.getByText(DIRTY_MESSAGE)).toBeInTheDocument();
    });
  });

  it('does not trigger drawer guard when only a dialog source is dirty', async () => {
    const user = new TestUserEvent();
    render(<TestWrapper />);

    await user.click(screen.getByRole('button', { name: 'dirty-a-dialog' }));
    await user.click(screen.getByRole('button', { name: 'close-drawer' }));

    expect(screen.queryByText(DIRTY_MESSAGE)).not.toBeInTheDocument();
  });
});

function FormWithBackButton({
  label,
  onCancel,
}: {
  label: string;
  onCancel?: (event?: unknown) => void;
}) {
  return (
    <button type="button" onClick={onCancel}>
      {label}
    </button>
  );
}

function DrawerBackOpener() {
  const dialog = useDialog();
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.setDirtySource('back-test', true, 'drawer')}
      >
        mark-drawer-back-dirty
      </button>
      <button
        type="button"
        onClick={() =>
          dialog.openDrawer({
            title: 'Drawer with Back',
            component: <FormWithBackButton label="drawer-back-button" />,
          })
        }
      >
        open-drawer-with-back
      </button>
    </>
  );
}

describe('DialogProvider cloned drawer onCancel forwards the synthetic event', () => {
  it('triggers dirty confirmation when the drawer Back button is clicked with a dirty source', async () => {
    const user = new TestUserEvent();
    render(<DrawerBackOpener />);

    await user.click(
      screen.getByRole('button', { name: 'mark-drawer-back-dirty' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'open-drawer-with-back' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'drawer-back-button' }),
    );

    await waitFor(() => {
      expect(screen.getByText(DIRTY_MESSAGE)).toBeInTheDocument();
    });
  });

  it('does not trigger drawer confirmation when the Back button is clicked with no dirty source', async () => {
    const user = new TestUserEvent();
    render(<DrawerBackOpener />);

    await user.click(
      screen.getByRole('button', { name: 'open-drawer-with-back' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'drawer-back-button' }),
    );

    expect(screen.queryByText(DIRTY_MESSAGE)).not.toBeInTheDocument();
  });
});
