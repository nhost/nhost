import {
  Redirect as ExpoRedirect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useMemo } from 'react';

/**
 * The navigation library as the screens see it: they reach Expo Router only
 * through this module.
 *
 * It is the same idea as `components/ui`: a seam with one implementation
 * behind it. If you need something this does not expose, add it here rather
 * than importing `expo-router` in a screen.
 */

/**
 * Where to go: a path, or a path with parameters to carry.
 *
 * The paths are the app's own routes, written the way the URL reads them, so
 * they are the same strings on both sides of the seam and the same ones
 * `signin/methods.ts` holds.
 */
export type Destination = string | { pathname: string; params: Params };

export type Params = Record<string, string>;

function href(to: Destination) {
  return typeof to === 'string'
    ? to
    : { pathname: to.pathname, params: to.params };
}

/**
 * Moves to another screen. `push` adds to the history, `replace` takes the
 * place of the screen it leaves, which is what signing in wants: the back
 * gesture should not return to the form someone has just finished with.
 */
export function useGo(): {
  push: (to: Destination) => void;
  replace: (to: Destination) => void;
} {
  const router = useRouter();

  return useMemo(
    () => ({
      push: (to: Destination) => router.push(href(to) as never),
      replace: (to: Destination) => router.replace(href(to) as never),
    }),
    [router],
  );
}

/**
 * The parameters the current screen was opened with. Everything arrives as a
 * string, because these come off a URL or a deep link.
 */
export function useParams<T extends Params>(): Partial<T> {
  return useLocalSearchParams<T>() as Partial<T>;
}

/**
 * Goes somewhere else instead of rendering. Returning this from a screen is
 * how a protected screen sends a signed-out visitor to sign in.
 */
export function Redirect({ to }: { to: Destination }) {
  return <ExpoRedirect href={href(to) as never} />;
}
