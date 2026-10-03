import { type ComponentProps, type ReactElement, useState } from 'react';
import { toast } from 'react-hot-toast';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './dialog';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

function ControlledDialog(
  props: Omit<ComponentProps<typeof DialogContent>, 'children'>,
) {
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent {...props}>
        <DialogTitle>Edit item</DialogTitle>
        <DialogDescription>Change the item details.</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

function getOverlay() {
  const overlay = screen.getByRole('dialog').parentElement;
  if (!overlay) {
    throw new Error('Dialog overlay not found');
  }
  return overlay;
}

afterEach(() => {
  toast.remove();
});

test.each([
  ['toast', (content: ReactElement) => toast(content)],
  ['toast.custom', (content: ReactElement) => toast.custom(content)],
])('stays open when a %s is clicked', async (_, showToast) => {
  const user = new TestUserEvent();
  const onToastAction = vi.fn();
  render(<ControlledDialog />);

  showToast(
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
  render(<ControlledDialog />);

  await user.click(getOverlay());

  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('calls onInteractOutside for outside clicks', async () => {
  const user = new TestUserEvent();
  const onInteractOutside = vi.fn();
  render(<ControlledDialog onInteractOutside={onInteractOutside} />);

  await user.click(getOverlay());

  expect(onInteractOutside).toHaveBeenCalledOnce();
});

test.each([
  { name: 'without onInteractOutside', props: {} },
  { name: 'with onInteractOutside', props: { onInteractOutside: vi.fn() } },
])(
  'stays open on overlay clicks with disableOutsideClick $name',
  async ({ props }) => {
    const user = new TestUserEvent();
    render(<ControlledDialog disableOutsideClick {...props} />);

    await user.click(getOverlay());

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  },
);
