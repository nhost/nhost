import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import Home from '@/screens/page';

const routes = { index: Home, 'signin/index': () => null };

describe('home screen', () => {
  it('sends a signed-out visitor to sign up', async () => {
    await renderRouter(routes);

    await fireEvent.press(screen.getByRole('link', { name: 'Sign up' }));

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({});
  });

  it('sends a signed-out visitor to sign in another way', async () => {
    await renderRouter(routes);

    await fireEvent.press(screen.getByRole('link', { name: 'another way in' }));

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({ intent: 'sign-in' });
  });
});
