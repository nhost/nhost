import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';
import StackTitle from '@/components/StackTitle';

type Node = { parent: Node | null; props: { accessible?: boolean } };

// VoiceOver reaches nothing inside an accessible element.
function insideAccessibleElement(node: Node): boolean {
  for (let at = node.parent; at; at = at.parent) {
    if (at.props.accessible) {
      return true;
    }
  }
  return false;
}

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

  it('keeps the links reachable outside the heading', async () => {
    await renderRouter({ index: StackTitle });

    for (const name of ['Nhost', 'React Native']) {
      const link = screen.getByRole('link', { name });
      expect(insideAccessibleElement(link as unknown as Node)).toBe(false);
    }
    expect(screen.queryByText('+')).toBeNull();
  });
});
