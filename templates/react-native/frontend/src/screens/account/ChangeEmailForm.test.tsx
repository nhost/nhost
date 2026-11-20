import { fireEvent, render, screen } from '@testing-library/react-native';
import ChangeEmailForm from '@/screens/account/ChangeEmailForm';

const mockChangeEmail = jest.fn();
const mockResendVerification = jest.fn();

jest.mock('@/screens/account/actions', () => ({
  changeEmail: (email: string) => mockChangeEmail(email),
  resendVerification: () => mockResendVerification(),
}));

const open = (verified: boolean) =>
  render(<ChangeEmailForm email="user@example.com" verified={verified} />);

beforeEach(() => {
  mockChangeEmail.mockReset();
  mockResendVerification.mockReset();
});

describe('change email form', () => {
  it('starts the change and says where the link went', async () => {
    mockChangeEmail.mockResolvedValueOnce({ success: true });
    await open(true);
    const send = screen.getByRole('button', { name: 'Send link' });
    expect(send).toBeDisabled();

    await fireEvent.changeText(
      screen.getByLabelText('New email'),
      'new@example.com',
    );
    await fireEvent.press(send);

    expect(mockChangeEmail).toHaveBeenCalledWith('new@example.com');
    expect(screen.getByRole('status')).toHaveTextContent(
      /confirmation link to new@example\.com.*changes when you open it/,
    );
  });

  it('says why the link did not go out', async () => {
    mockChangeEmail.mockResolvedValueOnce({ error: 'Nope.' });
    await open(true);

    await fireEvent.changeText(
      screen.getByLabelText('New email'),
      'new@example.com',
    );
    await fireEvent(screen.getByLabelText('New email'), 'submitEditing');

    expect(screen.getByRole('alert')).toHaveTextContent('Nope.');
  });

  it('offers another verification link only for an unverified address', async () => {
    await open(true);
    expect(
      screen.queryByRole('button', { name: 'Resend verification' }),
    ).toBeNull();

    mockResendVerification.mockResolvedValueOnce({ success: true });
    await open(false);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Resend verification' }),
    );

    expect(mockResendVerification).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Another verification link is on its way to user@example.com.',
    );
  });
});
