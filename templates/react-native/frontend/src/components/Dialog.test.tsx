import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import { useState } from 'react';
import { Text } from 'react-native';
import Dialog, { DialogClose, useCloseDialog } from '@/components/Dialog';
import ToastProvider, { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';

function Saves() {
  const toast = useToast();
  const close = useCloseDialog();
  return (
    <Button
      title="Save"
      onPress={() => {
        toast('Saved');
        close();
      }}
    />
  );
}

const mockLeft = jest.fn<void, [boolean]>();

function Leaves() {
  const close = useCloseDialog();
  return (
    <Button
      title="Leave"
      onPress={() =>
        close(() => mockLeft(screen.queryByText('Edit it?') === null))
      }
    />
  );
}

function Page() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button title="Open" onPress={() => setOpen(true)} />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Edit it?"
        description="Nothing changes until you save."
      >
        <Saves />
        <Leaves />
        <DialogClose />
      </Dialog>
    </>
  );
}

describe('dialog', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await renderRouter(
      {
        index: () => (
          <ToastProvider>
            <Page />
          </ToastProvider>
        ),
      },
      { initialUrl: '/' },
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows its title and description', () => {
    expect(screen.getByRole('heading', { name: 'Edit it?' })).toBeOnTheScreen();
    expect(
      screen.getByText('Nothing changes until you save.'),
    ).toBeOnTheScreen();
  });

  it.each([
    ['its cancel button', () => screen.getByRole('button', { name: 'Cancel' })],
    // Hidden from VoiceOver by the modal dialog beside it, whose own buttons
    // close it there.
    [
      'the backdrop',
      () => screen.getByLabelText('Close', { includeHiddenElements: true }),
    ],
  ])('closes from %s', async (_, target) => {
    await fireEvent.press(target());

    expect(screen.queryByText('Edit it?')).toBeNull();
  });

  // Android's back button: the event reaches the modal around the dialog.
  it('closes when the system asks it to', async () => {
    await fireEvent(screen.getByText('Edit it?'), 'requestClose');

    expect(screen.queryByText('Edit it?')).toBeNull();
  });

  it('lets a form close it, and its toast outlasts it for a while', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByText('Edit it?')).toBeNull();
    expect(screen.getByText('Saved')).toBeOnTheScreen();

    await act(async () => jest.advanceTimersByTime(2400));

    expect(screen.queryByText('Saved')).toBeNull();
  });

  // For what can't start while the dialog is up, such as the in-app browser.
  it('runs what follows a close once the dialog has gone', async () => {
    mockLeft.mockReset();

    await fireEvent.press(screen.getByRole('button', { name: 'Leave' }));

    expect(mockLeft.mock.calls).toEqual([[true]]);
  });
});

let show: ReturnType<typeof useToast> = () => () => undefined;

function Toasts() {
  show = useToast();
  return <Text>toasts</Text>;
}

describe('toast', () => {
  it('shows only the latest message, and its dismissal leaves a newer one', async () => {
    await renderRouter(
      {
        index: () => (
          <ToastProvider>
            <Toasts />
          </ToastProvider>
        ),
      },
      { initialUrl: '/' },
    );

    let dismissFirst: VoidFunction = () => undefined;
    await act(async () => {
      dismissFirst = show('First');
    });
    await act(async () => {
      show('Second');
    });
    await act(async () => dismissFirst());

    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getByText('Second')).toBeOnTheScreen();
  });
});
