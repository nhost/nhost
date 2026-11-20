import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import ToastProvider from '@/components/Toast';
import DisplayNameField from '@/screens/account/DisplayNameField';

const mockRefresh = jest.fn();
const mockUpdateDisplayName = jest.fn();

jest.mock('@/components/useRefresh', () => ({
  useRefresh: () => mockRefresh,
}));
jest.mock('@/screens/account/actions', () => ({
  updateDisplayName: (name: string) => mockUpdateDisplayName(name),
}));

beforeEach(async () => {
  mockRefresh.mockReset();
  mockUpdateDisplayName.mockReset();
  await renderRouter(
    {
      index: () => (
        <ToastProvider>
          <DisplayNameField displayName="Ada" />
        </ToastProvider>
      ),
    },
    { initialUrl: '/' },
  );
});

describe('display name field', () => {
  it('saves the new name, closes and loads the screen again', async () => {
    mockUpdateDisplayName.mockResolvedValueOnce({ success: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
    await fireEvent.changeText(
      screen.getByLabelText('Display name'),
      'Ada Lovelace',
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(mockUpdateDisplayName).toHaveBeenCalledWith('Ada Lovelace');
    expect(screen.queryByLabelText('Display name')).toBeNull();
    expect(screen.getByText('Name saved')).toBeOnTheScreen();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('keeps the form open and says why the name was not saved', async () => {
    mockUpdateDisplayName.mockResolvedValueOnce({
      error: 'A display name is required.',
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
    await fireEvent.changeText(screen.getByLabelText('Display name'), ' ');

    await fireEvent(screen.getByLabelText('Display name'), 'submitEditing');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A display name is required.',
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('forgets a cancelled edit', async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
    await fireEvent.changeText(screen.getByLabelText('Display name'), 'Bob');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Ada')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
    expect(screen.getByLabelText('Display name')).toHaveDisplayValue('Ada');
    expect(mockUpdateDisplayName).not.toHaveBeenCalled();
  });
});
