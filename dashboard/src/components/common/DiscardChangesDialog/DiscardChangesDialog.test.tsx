import { useState } from 'react';

import DiscardChangesDialog from '@/components/common/DiscardChangesDialog/DiscardChangesDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import {
  fireEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

interface ControlledDialogsProps {
  onConfirmationOpenChange: (open: boolean) => void;
  onDiscardChanges: VoidFunction;
  onParentOpenChange: (open: boolean) => void;
}

function ControlledDialogs({
  onConfirmationOpenChange,
  onDiscardChanges,
  onParentOpenChange,
}: ControlledDialogsProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const handleParentOpenChange = (open: boolean) => {
    onParentOpenChange(open);
    if (!open) {
      setConfirmationOpen(true);
    }
  };

  const handleConfirmationOpenChange = (open: boolean) => {
    onConfirmationOpenChange(open);
    setConfirmationOpen(open);
  };

  return (
    <>
      <Dialog open onOpenChange={handleParentOpenChange}>
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
        onOpenChange={handleConfirmationOpenChange}
        onDiscardChanges={onDiscardChanges}
      />
    </>
  );
}

describe('DiscardChangesDialog', () => {
  it('treats Escape as Cancel without closing or clearing its dirty parent', async () => {
    const user = new TestUserEvent();
    const onConfirmationOpenChange = vi.fn();
    const onDiscardChanges = vi.fn();
    const onParentOpenChange = vi.fn();

    render(
      <ControlledDialogs
        onConfirmationOpenChange={onConfirmationOpenChange}
        onDiscardChanges={onDiscardChanges}
        onParentOpenChange={onParentOpenChange}
      />,
    );

    const parentDialog = screen.getByRole('dialog', { name: 'Draft editor' });
    const draftInput = within(parentDialog).getByLabelText('Draft name');
    const parentCloseButton = within(parentDialog).getByRole('button', {
      name: 'Close',
    });
    await waitFor(() => expect(draftInput).toHaveFocus());
    await user.clear(draftInput);
    await user.type(draftInput, 'retained draft');

    await user.click(parentCloseButton);
    const firstConfirmation = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    expect(onParentOpenChange).toHaveBeenCalledTimes(1);
    expect(onParentOpenChange).toHaveBeenLastCalledWith(false);

    fireEvent.keyDown(firstConfirmation, { key: 'Escape' });

    await waitFor(() => {
      expect(firstConfirmation).not.toBeInTheDocument();
      expect(parentDialog).toContainElement(
        document.activeElement as HTMLElement,
      );
    });
    expect(onConfirmationOpenChange).toHaveBeenCalledTimes(1);
    expect(onConfirmationOpenChange).toHaveBeenLastCalledWith(false);
    expect(onParentOpenChange).toHaveBeenCalledTimes(1);
    expect(onDiscardChanges).not.toHaveBeenCalled();
    expect(parentDialog).toBeInTheDocument();
    expect(draftInput).toHaveValue('retained draft');

    await user.click(parentCloseButton);
    const secondConfirmation = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    expect(onParentOpenChange).toHaveBeenCalledTimes(2);

    await user.click(
      within(secondConfirmation).getByRole('button', { name: 'Cancel' }),
    );

    await waitFor(() => {
      expect(secondConfirmation).not.toBeInTheDocument();
      expect(parentDialog).toContainElement(
        document.activeElement as HTMLElement,
      );
    });
    expect(onConfirmationOpenChange).toHaveBeenCalledTimes(2);
    expect(onConfirmationOpenChange).toHaveBeenLastCalledWith(false);
    expect(onDiscardChanges).not.toHaveBeenCalled();
    expect(draftInput).toHaveValue('retained draft');

    await user.click(parentCloseButton);
    const thirdConfirmation = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });

    await user.click(
      within(thirdConfirmation).getByRole('button', { name: 'Discard' }),
    );

    await waitFor(() => expect(thirdConfirmation).not.toBeInTheDocument());
    expect(onConfirmationOpenChange).toHaveBeenCalledTimes(3);
    expect(onConfirmationOpenChange).toHaveBeenLastCalledWith(false);
    expect(onDiscardChanges).toHaveBeenCalledTimes(1);
    expect(parentDialog).toBeInTheDocument();
  });
});
