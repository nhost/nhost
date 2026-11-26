import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import EmailSetting from './EmailSetting';

const changeEmail = vi.fn();

vi.mock('@/hooks/useUserData', () => ({
  useUserData: () => ({ id: 'user-id', email: 'old@example.com' }),
}));

vi.mock(
  '@/features/account/settings/hooks/useActionWithElevatedPermissions',
  () => ({ default: () => changeEmail }),
);

async function submitNewEmail(user: TestUserEvent) {
  const input = screen.getByRole('textbox', { name: 'Email' });
  await user.clear(input);
  await user.type(input, 'new@example.com{Enter}');

  return screen.findByRole('alertdialog');
}

describe('EmailSetting', () => {
  beforeEach(() => {
    changeEmail.mockReset();
  });

  it('asks before sending the link when Enter is pressed', async () => {
    const user = new TestUserEvent();
    render(<EmailSetting />);

    const dialog = await submitNewEmail(user);

    expect(dialog).toHaveTextContent('new@example.com');
    expect(dialog).toHaveTextContent('old@example.com');
    expect(changeEmail).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Send link' }));

    await waitFor(() => {
      expect(changeEmail).toHaveBeenCalledWith('new@example.com');
    });
  });

  it('does not send anything when cancelled', async () => {
    const user = new TestUserEvent();
    render(<EmailSetting />);

    await submitNewEmail(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(changeEmail).not.toHaveBeenCalled();
  });
});
