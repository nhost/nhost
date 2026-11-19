import { renderRouter, screen } from 'expo-router/testing-library';
import RootLayout from '@/app/_layout';
import Home from '@/app/index';

it('renders the home screen at /', async () => {
  const router = await renderRouter({ _layout: RootLayout, index: Home });

  expect(router.getPathname()).toBe('/');
  expect(screen.getByText('Nhost + React Native')).toBeOnTheScreen();
});
