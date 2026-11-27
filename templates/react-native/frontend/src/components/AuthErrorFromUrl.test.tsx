import { renderRouter, screen } from 'expo-router/testing-library';
import AuthErrorFromUrl from '@/components/AuthErrorFromUrl';

const render = (query: string) =>
  renderRouter({ index: AuthErrorFromUrl }, { initialUrl: `/?${query}` });

describe('AuthErrorFromUrl', () => {
  // A link can carry any description, and the notice is shown by this app,
  // so showing it would let anyone put words in the app's mouth.
  it('never shows the description from the URL', async () => {
    const crafted =
      'errorDescription=Your+account+is+suspended.+Verify+it+at+evil.example';

    await render(`error=disabled-endpoint&${crafted}`);

    expect(screen.getByRole('alert')).toHaveTextContent(
      /\(disabled-endpoint\)/,
    );
    expect(screen.queryByText(/suspended|evil\.example/)).toBeNull();
    await screen.unmount();

    await render(`error=account-locked&${crafted}`);

    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in failed.');
    expect(screen.queryByText(/suspended|evil\.example/)).toBeNull();
  });

  it('shows nothing without an error', async () => {
    await render('errorDescription=Something');

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
