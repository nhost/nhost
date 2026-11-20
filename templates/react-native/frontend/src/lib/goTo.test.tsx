import { router, Stack } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { goTo, useGoTo } from '@/lib/goTo';

function Root() {
  useGoTo();
  return <Stack />;
}

const routes = {
  _layout: Root,
  index: () => <Text>home</Text>,
  'signin/index': () => <Text>signin</Text>,
  'account/index': () => <Text>account</Text>,
  'auth/_layout': () => <Stack />,
  'auth/one/index': () => <Text>one</Text>,
  'auth/one/two/index': () => <Text>two</Text>,
};

async function open(...hrefs: string[]): Promise<void> {
  await renderRouter(routes, { initialUrl: hrefs[0] });
  for (const href of hrefs.slice(1)) {
    await act(() => router.push(href));
  }
}

// A plain `dismissAll` from inside the nested stack would empty only that
// stack, leaving the sign-in screens under the destination.
describe('goTo', () => {
  it.each([
    ['nothing under it', ['/']],
    ['a root stack', ['/', '/signin']],
    ['a nested stack of one', ['/', '/signin', '/auth/one']],
    ['a nested stack of two', ['/', '/signin', '/auth/one', '/auth/one/two']],
    ['only a nested stack', ['/auth/one', '/auth/one/two']],
  ])('opens the route alone from %s', async (_, hrefs) => {
    jest.spyOn(console, 'error');
    await open(...hrefs);

    await act(async () => goTo('/account?tab=1'));

    expect(screen).toHavePathname('/account');
    expect(screen).toHaveSearchParams({ tab: '1' });
    expect(router.canGoBack()).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
  });
});
