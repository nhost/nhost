import { useState } from 'react';

import DiscardChangesDialog from '@/components/common/DiscardChangesDialog/DiscardChangesDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/v3/sheet';
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
      />
    </>
  );
}

describe('DiscardChangesDialog', () => {
  it('isolates Escape and restores focus inside a parent sheet', async () => {
    const user = new TestUserEvent();
    const onDiscardChanges = vi.fn();
    const onSheetOpenChange = vi.fn();

    render(
      <Sheet open onOpenChange={onSheetOpenChange}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Draft sheet</SheetTitle>
          <ControlledDialogs onDiscardChanges={onDiscardChanges} />
        </SheetContent>
      </Sheet>,
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
    expect(onSheetOpenChange).not.toHaveBeenCalled();
  });
});
