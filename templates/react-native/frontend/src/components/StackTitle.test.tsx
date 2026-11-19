import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';
import StackTitle from '@/components/StackTitle';

describe('StackTitle', () => {
  it("links each mark to its project's site", async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue();

    await renderRouter({ index: StackTitle });

    expect(
      screen.getByRole('heading', { name: 'Nhost + React Native' }),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('link', { name: 'Nhost' }));
    await fireEvent.press(screen.getByRole('link', { name: 'React Native' }));

    expect(openURL.mock.calls).toEqual([
      ['https://nhost.io'],
      ['https://reactnative.dev'],
    ]);
  });
});
