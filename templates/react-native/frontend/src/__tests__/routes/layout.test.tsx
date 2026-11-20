import { act, renderRouter, screen } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import RootLayout from '@/app/_layout';
import Home from '@/app/index';

type Gate = { resolve: VoidFunction; promise?: Promise<void> };

const gate = (): Gate => ({ resolve: () => undefined });

const mockGates = { startup: gate(), link: gate() };

const mockWait = (current: Gate): Promise<void> => {
  current.promise ??= new Promise((resolve) => {
    current.resolve = resolve;
  });
  return current.promise;
};

jest.mock('@/lib/nhost/startSession', () => ({
  startSession: () => mockWait(mockGates.startup),
}));

jest.mock('@/lib/nhost/links', () => ({
  ...jest.requireActual('@/lib/nhost/links'),
  settleInitialLink: () => mockWait(mockGates.link),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hide: jest.fn(),
}));

const heading = () => screen.queryByRole('heading');

beforeEach(() => {
  mockGates.startup = gate();
  mockGates.link = gate();
  jest.mocked(SplashScreen.hide).mockClear();
});

describe('the root layout', () => {
  // No screen may show a session that startup is about to change.
  it('keeps the splash up and renders nothing until startup settles', async () => {
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalled();

    await renderRouter({ _layout: RootLayout, index: Home });
    await act(async () => mockGates.link.resolve());

    expect(heading()).toBeNull();
    expect(SplashScreen.hide).not.toHaveBeenCalled();

    await act(async () => mockGates.startup.resolve());

    expect(
      screen.getByRole('heading', { name: 'Nhost + React Native' }),
    ).toBeOnTheScreen();
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  });

  // Nor one that the link that opened the app is about to sign in.
  it('renders nothing until the link that opened the app is handled', async () => {
    await renderRouter({ _layout: RootLayout, index: Home });
    await act(async () => mockGates.startup.resolve());

    expect(heading()).toBeNull();
    expect(SplashScreen.hide).not.toHaveBeenCalled();

    await act(async () => mockGates.link.resolve());

    expect(
      screen.getByRole('heading', { name: 'Nhost + React Native' }),
    ).toBeOnTheScreen();
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  });
});
