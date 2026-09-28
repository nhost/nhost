import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './sheet';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

function ControlledSheet() {
  const [open, setOpen] = useState(true);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent showOverlay>
        <SheetTitle>Edit item</SheetTitle>
        <SheetDescription>Change the item details.</SheetDescription>
      </SheetContent>
    </Sheet>
  );
}

afterEach(() => {
  toast.remove();
});

test('stays open when a toast is clicked', async () => {
  const user = new TestUserEvent();
  const onToastAction = vi.fn();
  render(<ControlledSheet />);

  toast(
    <button type="button" onClick={onToastAction}>
      Toast action
    </button>,
  );
  await user.click(
    await screen.findByRole('button', { name: 'Toast action', hidden: true }),
  );

  expect(onToastAction).toHaveBeenCalledOnce();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('closes when the overlay is clicked', async () => {
  const user = new TestUserEvent();
  render(<ControlledSheet />);

  const overlay = screen.getByRole('dialog').previousElementSibling;
  if (!overlay) {
    throw new Error('Sheet overlay not found');
  }
  await user.click(overlay);

  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});
