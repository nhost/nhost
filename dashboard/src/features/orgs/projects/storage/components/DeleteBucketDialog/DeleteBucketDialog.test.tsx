import { useState } from 'react';
import { vi } from 'vitest';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
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
    const user = new TestUserEvent();
    render(<Wrapper />);

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('should disable the Delete button again after unchecking the checkbox', async () => {
    const user = new TestUserEvent();
    render(<Wrapper />);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('should reset the checkbox when the dialog is closed via Cancel', async () => {
    const user = new TestUserEvent();

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

  it('should call onDelete when Delete button is clicked', async () => {
    const user = new TestUserEvent();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(<Wrapper onDelete={onDelete} />);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  it('should disable both buttons and show spinner during deletion', async () => {
    const user = new TestUserEvent();
    let resolveDelete: () => void;
    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    render(<Wrapper onDelete={onDelete} />);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();

    resolveDelete!();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    });
  });
});
