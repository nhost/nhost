import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import ToastProvider from '@/components/Toast';
import CopyUserId from '@/screens/account/CopyUserId';

const mockSetString = jest.fn<Promise<boolean>, [string]>();

jest.mock('expo-clipboard', () => ({
  setStringAsync: (text: string) => mockSetString(text),
}));

const ID = '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24';

beforeEach(async () => {
  mockSetString.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await renderRouter(
    {
      index: () => (
        <ToastProvider>
          <CopyUserId id={ID} />
        </ToastProvider>
      ),
    },
    { initialUrl: '/' },
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('copy user id', () => {
  it('copies the id and says so', async () => {
    mockSetString.mockResolvedValueOnce(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Copy user ID' }));

    expect(mockSetString).toHaveBeenCalledWith(ID);
    expect(screen.getByText('User ID copied')).toBeOnTheScreen();
  });

  it('says so when the clipboard refuses', async () => {
    mockSetString.mockRejectedValueOnce(new Error('denied'));

    await fireEvent.press(screen.getByRole('button', { name: 'Copy user ID' }));

    expect(screen.getByText('Could not copy the user ID')).toBeOnTheScreen();
  });
});
