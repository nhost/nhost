import { act, renderRouter, screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import RootLayout from '@/app/_layout';
import Home from '@/app/index';

const mockStartup: { resolve: VoidFunction; started?: Promise<void> } = {
  resolve: () => undefined,
};

jest.mock('@/lib/nhost/startSession', () => ({
  startSession: () => {
    mockStartup.started ??= new Promise((resolve) => {
      mockStartup.resolve = resolve;
    });
    return mockStartup.started;
  },
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hide: jest.fn(),
}));

describe('the root layout', () => {
  // No screen may show a session that startup is about to change.
  it('keeps the splash up and renders nothing until startup settles', async () => {
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalled();

    await renderRouter({ _layout: RootLayout, index: Home });

    expect(screen.queryByRole('heading')).toBeNull();
    expect(SplashScreen.hide).not.toHaveBeenCalled();

    await act(async () => mockStartup.resolve());

    expect(
      screen.getByRole('heading', { name: 'Nhost + React Native' }),
    ).toBeOnTheScreen();
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  });
});
