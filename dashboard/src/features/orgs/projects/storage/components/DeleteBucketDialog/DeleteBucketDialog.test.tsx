import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@/tests/testUtils';
import DeleteBucketDialog from './DeleteBucketDialog';

function Wrapper({ onDelete = vi.fn() }: { onDelete?: () => Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <DeleteBucketDialog
      bucketId="avatars"
      open={open}
      onOpenChange={setOpen}
      onDelete={onDelete}
    />
  );
}

describe('DeleteBucketDialog', () => {
  it('should have the Delete button disabled when the checkbox is unchecked', () => {
    render(<Wrapper />);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('should enable the Delete button after checking the confirmation checkbox', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('should disable the Delete button again after unchecking the checkbox', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('should reset the checkbox when the dialog is closed via Cancel', async () => {
    const user = userEvent.setup();

    function ReopenableWrapper() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Reopen
          </button>
          <DeleteBucketDialog
            bucketId="avatars"
            open={open}
            onOpenChange={setOpen}
            onDelete={vi.fn()}
          />
        </>
      );
    }

    render(<ReopenableWrapper />);

    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Reopen' }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox')).not.toBeChecked();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    });
  });
});
