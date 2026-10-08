import {
  type NavigationProp,
  StackActions,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useEffect, useMemo } from 'react';

/**
 * Everything this app does with its navigation library, and the only module
 * that imports one.
 *
 * This is the React Navigation implementation of the seam. The Expo Router one
 * has the same exports and the screens import nothing else, which is the whole
 * of what makes the two interchangeable. If you need something this does not
 * expose, add it here rather than importing `@react-navigation/native` in a
 * screen.
 *
 * A screen's name in the navigator is its path - `src/screens.ts` registers
 * them that way - so a `Destination` is the same string on either side of the
 * seam, and `signin/methods.ts` is correct for both.
 */

export type Destination = string | { pathname: string; params: Params };

export type Params = Record<string, string>;

function target(to: Destination): [string, Params | undefined] {
  return typeof to === 'string' ? [to, undefined] : [to.pathname, to.params];
}

// The screens are registered by path and take their parameters as a plain
// record, which is all this seam ever passes.
type Nav = NavigationProp<Record<string, Params | undefined>>;

/**
 * Moves to another screen. `push` adds to the history, `replace` takes the
 * place of the screen it leaves, which is what signing in wants: the back
 * gesture should not return to the form someone has just finished with.
 */
export function useGo(): {
  push: (to: Destination) => void;
  replace: (to: Destination) => void;
} {
  const navigation = useNavigation<Nav>();

  return useMemo(
    () => ({
      push: (to: Destination) => {
        const [name, params] = target(to);
        navigation.navigate(name, params);
      },
      replace: (to: Destination) => {
        const [name, params] = target(to);
        // The stack's own action for taking the place of the screen on top,
        // rather than pushing over it.
        navigation.dispatch(StackActions.replace(name, params));
      },
    }),
    [navigation],
  );
}

/**
 * The parameters the current screen was opened with. Everything arrives as a
 * string, because these come off a deep link.
 */
export function useParams<T extends Params>(): Partial<T> {
  const route = useRoute();

  return (route.params ?? {}) as Partial<T>;
}

/**
 * Goes somewhere else instead of rendering. Returning this from a screen is
 * how a protected screen sends a signed-out visitor to sign in.
 *
 * React Navigation has no component for this - navigating is a side effect, so
 * it happens in an effect and this renders nothing. Expo Router's `Redirect`
 * is the same thing with the effect hidden inside it.
 */
export function Redirect({ to }: { to: Destination }) {
  const go = useGo();

  useEffect(() => {
    go.replace(to);
  }, [go, to]);

  return null;
}
