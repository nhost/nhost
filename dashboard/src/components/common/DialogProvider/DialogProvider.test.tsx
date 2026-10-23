import type { MouseEventHandler } from 'react';
import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { mockRouter } from '@/tests/mocks';
import {
  fireEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
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

function GuardedContent({
  location,
  onCancel,
  onSubmit,
}: {
  location?: 'drawer' | 'dialog';
  onCancel?: (event?: unknown) => void;
  onSubmit?: () => Promise<unknown>;
}) {
  const dialog = useDialog();
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.setDirtySource('guard-form', true, location)}
      >
        Mark dirty
      </button>
      <button type="button" onClick={onCancel}>
        Cancel form
      </button>
      <button type="button" onClick={onSubmit}>
        Submit form
      </button>
    </>
  );
}

function GuardOpener({ location }: { location: 'drawer' | 'dialog' }) {
  const dialog = useDialog();
  return (
    <button
      type="button"
      onClick={() => {
        const open =
          location === 'drawer' ? dialog.openDrawer : dialog.openDialog;
        open({ title: 'Guarded form', component: <GuardedContent /> });
      }}
    >
      Open guarded form
    </button>
  );
}

describe.each(['drawer', 'dialog'] as const)(
  'DialogProvider %s dirty guard',
  (location) => {
    async function openForm(user: TestUserEvent) {
      await user.click(
        screen.getByRole('button', { name: 'Open guarded form' }),
      );
      await screen.findByText('Guarded form');
    }

    it('shows confirmation on Escape when dirty, then discards the form', async () => {
      const user = new TestUserEvent();
      render(<GuardOpener location={location} />);
      await openForm(user);
      await user.click(screen.getByRole('button', { name: 'Mark dirty' }));
      await user.keyboard('{Escape}');

      expect(await screen.findByText('Unsaved changes')).toBeInTheDocument();
      expect(screen.getByText('Discard')).toBeInTheDocument();
      expect(screen.getByText('Guarded form')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Discard' }));
      await waitFor(() => {
        expect(screen.queryByText('Guarded form')).not.toBeInTheDocument();
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
      });
    });

    it('closes on Escape without confirmation when clean', async () => {
      const user = new TestUserEvent();
      render(<GuardOpener location={location} />);
      await openForm(user);
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Guarded form')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    });

    it('guards the injected cancel action when dirty', async () => {
      const user = new TestUserEvent();
      render(<GuardOpener location={location} />);
      await openForm(user);
      await user.click(screen.getByRole('button', { name: 'Mark dirty' }));
      await user.click(screen.getByRole('button', { name: 'Cancel form' }));

      expect(await screen.findByText('Unsaved changes')).toBeInTheDocument();
      expect(screen.getByText('Discard')).toBeInTheDocument();
      expect(screen.getByText('Guarded form')).toBeInTheDocument();
    });

    it('closes on injected submit without confirmation when dirty', async () => {
      const user = new TestUserEvent();
      render(<GuardOpener location={location} />);
      await openForm(user);
      await user.click(screen.getByRole('button', { name: 'Mark dirty' }));
      await user.click(screen.getByRole('button', { name: 'Submit form' }));

      await waitFor(() => {
        expect(screen.queryByText('Guarded form')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    });
  },
);

describe('DialogProvider alert actions', () => {
  it.each(['primary', 'secondary'] as const)(
    'runs the %s callback and closes the alert',
    async (action) => {
      const callback = vi.fn();
      const user = new TestUserEvent();

      function AlertOpener() {
        const dialog = useDialog();
        return (
          <button
            type="button"
            onClick={() =>
              dialog.openAlertDialog({
                title: 'Action alert',
                payload: 'Choose an action',
                props: {
                  primaryButtonText: 'Proceed',
                  secondaryButtonText: 'Go back',
                  ...(action === 'primary'
                    ? { onPrimaryAction: callback }
                    : { onSecondaryAction: callback }),
                },
              })
            }
          >
            Open action alert
          </button>
        );
      }

      render(<AlertOpener />);
      await user.click(
        screen.getByRole('button', { name: 'Open action alert' }),
      );
      expect(await screen.findByText('Action alert')).toBeInTheDocument();
      await user.click(
        screen.getByRole('button', {
          name: action === 'primary' ? 'Proceed' : 'Go back',
        }),
      );

      expect(callback).toHaveBeenCalledOnce();
      await waitFor(() => {
        expect(screen.queryByText('Action alert')).not.toBeInTheDocument();
      });
    },
  );
});

function LayerControls({
  onExited,
  onDialogClose,
  drawerClassName,
  dialogClassName,
}: {
  onExited?: VoidFunction;
  onDialogClose?: MouseEventHandler;
  drawerClassName?: string;
  dialogClassName?: string;
}) {
  const dialog = useDialog();
  const openDialog = () =>
    dialog.openDialog({
      title: 'Layer dialog',
      component: <LayerContent location="dialog" />,
      props: {
        titleProps: { onClose: onDialogClose },
        PaperProps: { className: dialogClassName },
      },
    });
  return (
    <>
      <button
        type="button"
        onClick={() =>
          dialog.openDrawer({
            title: 'Layer drawer',
            component: (
              <LayerContent location="drawer" openDialog={openDialog} />
            ),
            props: { PaperProps: { className: drawerClassName } },
          })
        }
      >
        Open drawer
      </button>
      <button type="button" onClick={openDialog}>
        Open dialog
      </button>
      <button
        type="button"
        onClick={() =>
          dialog.openAlertDialog({
            title: 'Layer alert',
            payload: 'Alert message',
            props: { TransitionProps: { onExited } },
          })
        }
      >
        Open alert
      </button>
      <button
        type="button"
        onClick={() =>
          dialog.openDirtyConfirmation({
            props: { onPrimaryAction: vi.fn() },
          })
        }
      >
        Open dirty confirmation
      </button>
      <button
        type="button"
        onClick={() =>
          dialog.openAlertDialog({
            title: 'No actions',
            payload: <button type="button">Focus me</button>,
            props: { hidePrimaryAction: true, hideSecondaryAction: true },
          })
        }
      >
        Open no-button alert
      </button>
      <button
        type="button"
        onClick={() =>
          dialog.openAlertDialog({
            title: 'Empty alert',
            payload: 'No focusable controls',
            props: { hidePrimaryAction: true, hideSecondaryAction: true },
          })
        }
      >
        Open empty alert
      </button>
      <button
        type="button"
        onClick={() => {
          dialog.closeAlertDialog();
          dialog.openAlertDialog({
            title: 'Reopened alert',
            payload: 'Fresh payload',
          });
        }}
      >
        Replace alert
      </button>
      <div data-testid="toast-like">Toast</div>
    </>
  );
}

function LayerContent({
  location,
  openDialog,
}: {
  location?: 'drawer' | 'dialog';
  openDialog?: VoidFunction;
}) {
  const dialog = useDialog();
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.setDirtySource('layer', true, location)}
      >
        Dirty layer
      </button>
      {openDialog && (
        <button type="button" onClick={openDialog}>
          Open inner dialog
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          dialog.openAlertDialog({
            title: 'Layer alert',
            payload: 'Alert message',
          })
        }
      >
        Open inner alert
      </button>
    </>
  );
}

// Radix listens to pointerdown rather than click for outside dismissals.
async function pointerDown(target: HTMLElement) {
  await new Promise((resolve) => setTimeout(resolve, 20));
  await waitFor(() => {
    fireEvent.pointerDown(target, { button: 0, pointerType: 'mouse' });
    fireEvent.click(target);
  });
}

describe('DialogProvider Radix layers', () => {
  it('uses an alertdialog for dirty confirmations and invokes the discard action', async () => {
    const user = new TestUserEvent();
    const onPrimaryAction = vi.fn();
    function Opener() {
      const dialog = useDialog();
      return (
        <button
          type="button"
          onClick={() =>
            dialog.openDirtyConfirmation({ props: { onPrimaryAction } })
          }
        >
          Confirm discard
        </button>
      );
    }
    render(<Opener />);
    await user.click(screen.getByRole('button', { name: 'Confirm discard' }));
    const alert = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    await user.click(within(alert).getByRole('button', { name: 'Discard' }));
    expect(onPrimaryAction).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
  });

  it('calls onExited after action close and Escape, and focuses the first content control without actions', async () => {
    const user = new TestUserEvent();
    const onExited = vi.fn();
    render(<LayerControls onExited={onExited} />);
    await user.click(screen.getByRole('button', { name: 'Open alert' }));
    expect(
      await screen.findByRole('alertdialog', { name: 'Layer alert' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onExited).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Open alert' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(onExited).toHaveBeenCalledTimes(2));
    await user.click(
      screen.getByRole('button', { name: 'Open no-button alert' }),
    );
    const noButton = await screen.findByRole('alertdialog', {
      name: 'No actions',
    });
    expect(
      within(noButton).getByRole('button', { name: 'Focus me' }),
    ).toHaveFocus();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Open empty alert' }));
    expect(
      await screen.findByRole('alertdialog', { name: 'Empty alert' }),
    ).toHaveFocus();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Open alert' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Replace alert', hidden: true }),
    );
    expect(
      await screen.findByRole('alertdialog', { name: 'Reopened alert' }),
    ).toHaveTextContent('Fresh payload');
  });

  it.each(['drawer', 'dialog'] as const)(
    'guards %s backdrop only, not body or toast',
    async (location) => {
      const user = new TestUserEvent();
      render(<LayerControls />);
      await user.click(
        screen.getByRole('button', { name: `Open ${location}` }),
      );
      const layer = await screen.findByRole('dialog', {
        name: `Layer ${location}`,
      });
      await pointerDown(document.body);
      await pointerDown(screen.getByTestId('toast-like'));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(layer).toBeInTheDocument();
      await user.click(
        within(layer).getByRole('button', { name: 'Dirty layer' }),
      );
      const backdrop =
        location === 'drawer'
          ? document.querySelector('[data-state="open"].z-40.bg-black\\/30')
          : layer.parentElement;
      expect(backdrop).not.toBeNull();
      await pointerDown(backdrop as HTMLElement);
      expect(
        await screen.findByRole('alertdialog', { name: 'Unsaved changes' }),
      ).toBeInTheDocument();
      expect(layer).toBeInTheDocument();
    },
  );

  it.each(['drawer', 'dialog'] as const)(
    'closes clean %s on its backdrop',
    async (location) => {
      const user = new TestUserEvent();
      render(<LayerControls />);
      await user.click(
        screen.getByRole('button', { name: `Open ${location}` }),
      );
      const layer = await screen.findByRole('dialog', {
        name: `Layer ${location}`,
      });
      const backdrop =
        location === 'drawer'
          ? document.querySelector('[data-state="open"].z-40.bg-black\\/30')
          : layer.parentElement;
      await pointerDown(backdrop as HTMLElement);
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: `Layer ${location}` }),
        ).not.toBeInTheDocument(),
      );
    },
  );

  it('guards the drawer X, while dialog X delegates only to titleProps.onClose', async () => {
    const user = new TestUserEvent();
    const onClose = vi.fn();
    render(<LayerControls onDialogClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    const drawer = await screen.findByRole('dialog', { name: 'Layer drawer' });
    await user.click(
      within(drawer).getByRole('button', { name: 'Dirty layer' }),
    );
    await user.click(within(drawer).getByRole('button', { name: 'Close' }));
    expect(
      await screen.findByRole('alertdialog', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(
      within(drawer).getByRole('button', { name: 'Open inner dialog' }),
    );
    const modal = await screen.findByRole('dialog', { name: 'Layer dialog' });
    await user.click(within(modal).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(modal).toBeInTheDocument();
  });

  it('preserves a drawer beneath an inner dialog and alert; Escape closes only the top layer', async () => {
    const user = new TestUserEvent();
    render(<LayerControls />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    const drawer = await screen.findByRole('dialog', { name: 'Layer drawer' });
    await user.click(
      within(drawer).getByRole('button', { name: 'Dirty layer' }),
    );
    await user.click(
      within(drawer).getByRole('button', { name: 'Open inner dialog' }),
    );
    const modal = await screen.findByRole('dialog', { name: 'Layer dialog' });
    expect(drawer).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(modal).not.toBeInTheDocument());
    expect(drawer).toBeInTheDocument();
    await user.keyboard('{Escape}');
    const alert = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    expect(drawer).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'Discard' }));
    await waitFor(() => {
      expect(drawer).not.toBeInTheDocument();
      expect(document.body.style.pointerEvents).toBe('');
    });
  });

  it('keeps clean drawers open on focus transfer and dialogs open beneath alerts', async () => {
    const user = new TestUserEvent();
    render(<LayerControls />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    const drawer = await screen.findByRole('dialog', { name: 'Layer drawer' });
    await user.click(
      within(drawer).getByRole('button', { name: 'Open inner dialog' }),
    );
    const modal = await screen.findByRole('dialog', { name: 'Layer dialog' });
    await user.click(
      within(modal).getByRole('button', { name: 'Open inner alert' }),
    );
    expect(
      await screen.findByRole('alertdialog', { name: 'Layer alert' }),
    ).toBeInTheDocument();
    expect(modal).toBeInTheDocument();
    expect(drawer).toBeInTheDocument();
  });

  it('makes slots without caller overflow utilities scrollable', async () => {
    const user = new TestUserEvent();
    render(<LayerControls />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    const drawer = await screen.findByRole('dialog', { name: 'Layer drawer' });
    expect(drawer).toHaveClass('overflow-y-auto');
    await user.click(
      within(drawer).getByRole('button', { name: 'Open inner dialog' }),
    );
    const modal = await screen.findByRole('dialog', { name: 'Layer dialog' });
    expect(modal).toHaveClass('overflow-y-auto');
    await user.click(
      within(modal).getByRole('button', { name: 'Open inner alert' }),
    );
    const alert = await screen.findByRole('alertdialog', {
      name: 'Layer alert',
    });
    expect(alert).toHaveClass('max-h-[calc(100dvh-4rem)]', 'overflow-y-auto');
  });

  it('retains caller width and overflow utilities without competing defaults', async () => {
    const user = new TestUserEvent();
    render(
      <LayerControls
        drawerClassName="lg:w-[65%] lg:max-w-7xl [overflow-y:initial]"
        dialogClassName="max-w-2xl overflow-hidden"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    const drawer = await screen.findByRole('dialog', { name: 'Layer drawer' });
    expect(drawer).toHaveClass(
      'sm:max-w-4xl',
      'lg:w-[65%]',
      'lg:max-w-7xl',
      '[overflow-y:initial]',
    );
    expect(drawer).not.toHaveClass('overflow-y-auto');
    await user.click(
      within(drawer).getByRole('button', { name: 'Open inner dialog' }),
    );
    const modal = await screen.findByRole('dialog', { name: 'Layer dialog' });
    expect(modal).toHaveClass('max-w-2xl', 'overflow-hidden');
    expect(modal).not.toHaveClass('max-w-md', 'overflow-y-auto');
  });
});

describe('DialogProvider layer dismissal details', () => {
  it('routes dialog title close through the dirty guard when its caller requests it', async () => {
    const user = new TestUserEvent();
    function Opener() {
      const dialog = useDialog();
      return (
        <button
          type="button"
          onClick={() =>
            dialog.openDialog({
              title: 'Guarded title',
              component: <LayerContent location="dialog" />,
              props: {
                titleProps: { onClose: dialog.closeDialogWithDirtyGuard },
              },
            })
          }
        >
          Open titled dialog
        </button>
      );
    }
    render(<Opener />);
    await user.click(
      screen.getByRole('button', { name: 'Open titled dialog' }),
    );
    const modal = await screen.findByRole('dialog', { name: 'Guarded title' });
    await user.click(
      within(modal).getByRole('button', { name: 'Dirty layer' }),
    );
    await user.click(within(modal).getByRole('button', { name: 'Close' }));
    expect(
      await screen.findByRole('alertdialog', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
    expect(modal).toBeInTheDocument();
  });

  it('releases the body pointer lock when navigation closes both slots', async () => {
    const user = new TestUserEvent();
    render(<LayerControls />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    const drawer = await screen.findByRole('dialog', { name: 'Layer drawer' });
    await user.click(
      within(drawer).getByRole('button', { name: 'Open inner dialog' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Layer dialog' }),
    ).toBeInTheDocument();
    const listeners = vi.mocked(mockRouter.events.on).mock.calls;
    const routeListener = listeners.findLast(
      ([event]) => event === 'routeChangeStart',
    )?.[1];
    expect(routeListener).toBeDefined();
    routeListener?.('new-route', { shallow: false });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.body.style.pointerEvents).toBe('');
    });
  });
});

describe('DialogProvider focus restore', () => {
  function AutoFocusOpener() {
    const dialog = useDialog();
    const content = (
      <div>
        {/* biome-ignore lint/a11y/noAutofocus: the case under test */}
        <input aria-label="Autofocused field" autoFocus />
      </div>
    );
    return (
      <>
        <button
          type="button"
          onClick={() =>
            dialog.openDialog({ title: 'Form', component: content })
          }
        >
          Open dialog
        </button>
        <button
          type="button"
          onClick={() =>
            dialog.openDrawer({ title: 'Form', component: content })
          }
        >
          Open drawer
        </button>
        <button
          type="button"
          onClick={() =>
            dialog.openDialog({ title: 'Swapped', component: <p>Swapped</p> })
          }
        >
          Swap dialog
        </button>
      </>
    );
  }

  it.each([
    ['Open dialog', 'dialog'],
    ['Open drawer', 'drawer'],
  ])(
    'returns focus to the opener after %s with autofocused content',
    async (opener) => {
      const user = new TestUserEvent();
      render(<AutoFocusOpener />);
      await user.click(screen.getByRole('button', { name: opener }));
      await waitFor(() =>
        expect(screen.getByLabelText('Autofocused field')).toHaveFocus(),
      );
      await user.keyboard('{Escape}');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: opener })).toHaveFocus(),
      );
    },
  );

  it('keeps the original opener when an open dialog is opened again', async () => {
    const user = new TestUserEvent();
    render(<AutoFocusOpener />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Autofocused field')).toHaveFocus(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Swap dialog', hidden: true }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Swapped' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveFocus(),
    );
  });

  it('does not steal focus back when the user moved focus before the drawer finished closing', async () => {
    function CloseAndMoveOn({ target }: { target: HTMLElement | null }) {
      const dialog = useDialog();
      return (
        <button
          type="button"
          onClick={() => {
            flushSync(() => dialog.closeDrawer());
            target?.focus();
          }}
        >
          Close and move on
        </button>
      );
    }

    function Opener() {
      const dialog = useDialog();
      const elsewhereRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button
            type="button"
            onClick={() =>
              dialog.openDrawer({
                title: 'Form',
                component: <CloseAndMoveOn target={elsewhereRef.current} />,
              })
            }
          >
            Open drawer
          </button>
          <button ref={elsewhereRef} type="button">
            Elsewhere
          </button>
        </>
      );
    }

    const user = new TestUserEvent();
    render(<Opener />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    await user.click(
      await screen.findByRole('button', { name: 'Close and move on' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Close and move on' }),
      ).not.toBeInTheDocument(),
    );
    // Let Radix's deferred onCloseAutoFocus run.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });
});
