import { renderRouter, screen } from 'expo-router/testing-library';
import RootLayout from '@/app/_layout';
import NotFoundRoute from '@/app/+not-found';
import Home from '@/app/index';

const routes = {
  _layout: RootLayout,
  index: Home,
  '+not-found': NotFoundRoute,
};

describe('routes', () => {
  it('renders the home screen at / inside the shell', async () => {
    const router = await renderRouter(routes);

    expect(router.getPathname()).toBe('/');
    expect(
      screen.getByRole('heading', { name: 'Nhost + React Native' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Docs' })).toBeOnTheScreen();
  });

  it('renders the not-found screen for a path without one', async () => {
    const router = await renderRouter(routes, { initialUrl: '/nowhere' });

    expect(router.getPathname()).toBe('/nowhere');
    expect(screen.getByText('This page could not be found.')).toBeOnTheScreen();
  });

  // The shell shows auth's error code on any screen, without its description.
  it('shows an auth error from the URL', async () => {
    await renderRouter(routes, {
      initialUrl: '/?error=invalid-ticket&errorDescription=Visit+evil.example',
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This link is invalid or has expired. Request a new one. (invalid-ticket)',
    );
    expect(screen.queryByText(/evil\.example/)).toBeNull();
  });
});
