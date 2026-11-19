import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import Nav from '@/components/Nav';

function Screen() {
  return <Nav />;
}

const routes = { index: Screen, 'signin/index': Screen };

describe('Nav', () => {
  it('offers a signed-out visitor both ways in', async () => {
    await renderRouter(routes);

    await fireEvent.press(screen.getByRole('link', { name: 'Sign in' }));

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({ intent: 'sign-in' });

    await fireEvent.press(screen.getByRole('link', { name: 'Sign up' }));

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({});
  });

  it('links home from the mark', async () => {
    await renderRouter(routes, { initialUrl: '/signin' });

    await fireEvent.press(screen.getByRole('link', { name: 'Nhost' }));

    expect(screen).toHavePathname('/');
  });
});
