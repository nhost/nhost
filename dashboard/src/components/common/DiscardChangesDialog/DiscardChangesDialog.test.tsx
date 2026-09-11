import { useState } from 'react';

import DiscardChangesDialog from '@/components/common/DiscardChangesDialog/DiscardChangesDialog';
import { Drawer } from '@/components/ui/v2/Drawer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import {
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

function ControlledDialogs({
  onDiscardChanges,
}: {
  onDiscardChanges: VoidFunction;
}) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  return (
    <>
      <Dialog open onOpenChange={() => setConfirmationOpen(true)}>
        <DialogContent>
          <DialogTitle>Draft editor</DialogTitle>
          <DialogDescription>
            Edit a draft before attempting to close this dialog.
          </DialogDescription>
          <label htmlFor="draft-name">Draft name</label>
          <input id="draft-name" defaultValue="original" />
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        onDiscardChanges={onDiscardChanges}
        onEscapeKeyDown={(event) => event.stopPropagation()}
      />
    </>
  );
}

describe('DiscardChangesDialog', () => {
  it.each([
    false,
    true,
  ])('isolates Escape and restores focus with a parent drawer: %s', async (insideDrawer) => {
    const user = new TestUserEvent();
    const onDiscardChanges = vi.fn();
    const onDrawerClose = vi.fn();
    const dialogs = <ControlledDialogs onDiscardChanges={onDiscardChanges} />;

    render(
      insideDrawer ? (
        <Drawer open title="Draft drawer" onClose={onDrawerClose}>
          {dialogs}
        </Drawer>
      ) : (
        dialogs
      ),
    );

    const parentDialog = screen.getByRole('dialog', { name: 'Draft editor' });
    const parentCloseButton = within(parentDialog).getByRole('button', {
      name: 'Close',
    });

    await user.click(parentCloseButton);
    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(confirmation).not.toBeInTheDocument());
    expect(parentCloseButton).toHaveFocus();
    expect(parentDialog).toBeInTheDocument();
    expect(onDiscardChanges).not.toHaveBeenCalled();
    expect(onDrawerClose).not.toHaveBeenCalled();
  });
});
