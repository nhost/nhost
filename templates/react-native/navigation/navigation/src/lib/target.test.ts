import {
  type ParamListBase,
  type StackNavigationState,
  StackRouter,
} from '@react-navigation/native';
import { describe, expect, it, vi } from 'vitest';
import type { Params } from '@/lib/navigation';
import { backTo, target } from '@/lib/target';
import { linkPath } from '@/linkPath';

// `@react-navigation/native` is `@react-navigation/core` plus the parts that
// need a device, so the core it depends on stands in for it.
vi.mock('@react-navigation/native', () => import('@react-navigation/core'));

// The linking config `App.tsx` builds, for screens named as `src/screens.ts`
// names them.
function config(names: string[]) {
  return {
    screens: Object.fromEntries(names.map((name) => [name, linkPath(name)])),
  };
}

const app = config([
  '/',
  '/signin',
  '/protected',
  '/notes/[id]',
  '/(tabs)/feed',
]);

describe('target', () => {
  it('reaches a static screen by its path', () => {
    expect(target('/protected', app)[0]).toBe('/protected');
  });

  // A sign-in link's `next` can carry a query, and each method replaces the
  // form with it once someone has signed in.
  it('takes a query as parameters rather than as part of the name', () => {
    expect(target('/protected?tab=1', app)).toEqual([
      '/protected',
      { tab: '1' },
    ]);
    expect(target('/protected/', app)).toEqual(['/protected', {}]);
  });

  it('carries the parameters a destination names', () => {
    expect(
      target({ pathname: '/signin', params: { next: '/protected' } }, app),
    ).toEqual(['/signin', { next: '/protected' }]);
  });

  it('reads a screen with a parameter the way Expo Router does', () => {
    expect(target('/notes/42', app)).toEqual(['/notes/[id]', { id: '42' }]);
    expect(target('/feed', app)).toEqual(['/(tabs)/feed', {}]);
  });

  it('goes home rather than nowhere for a path no screen is at', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const path of ['/nowhere', '/auth/../protected', '/protected#top']) {
      expect(target(path, app)).toEqual(['/', {}]);
    }
  });

  it('sends what no screen matches to a catch-all or +not-found', () => {
    const withCatchAll = config([
      '/',
      '/notes/[id]',
      '/files/[...rest]',
      '/+not-found',
    ]);

    expect(target('/files/a/b', withCatchAll)).toEqual([
      '/files/[...rest]',
      {},
    ]);
    expect(target('/notes/42', withCatchAll)).toEqual([
      '/notes/[id]',
      { id: '42' },
    ]);
    expect(target('/nowhere', withCatchAll)).toEqual(['/+not-found', {}]);
  });
});

describe('backTo', () => {
  const screens = config(['/', '/signin', '/auth/password']);
  const router = StackRouter({});
  const options = {
    routeNames: Object.keys(screens.screens),
    routeParamList: {},
    routeGetIdList: {},
  };
  const carried = { next: '/protected', intent: 'sign-in' };

  function stack(...routes: [string, Params?][]) {
    return router.getRehydratedState(
      { routes: routes.map(([name, params]) => ({ name, params })) },
      options,
    );
  }

  // What a method's "Other ways to sign in" link leaves on the stack.
  function backToSignIn(state: StackNavigationState<ParamListBase>) {
    const action = backTo({ pathname: '/signin', params: carried }, screens);

    return router
      .getStateForAction(state, action, options)
      ?.routes.map(({ name, params }) => [name, params]);
  }

  it('returns to the screen beneath rather than stacking another', () => {
    expect(
      backToSignIn(
        stack(['/'], ['/signin', carried], ['/auth/password', carried]),
      ),
    ).toEqual([
      ['/', undefined],
      ['/signin', carried],
    ]);
  });

  it("takes the current screen's place when nothing beneath matches", () => {
    expect(backToSignIn(stack(['/auth/password', carried]))).toEqual([
      ['/signin', carried],
    ]);
  });
});
