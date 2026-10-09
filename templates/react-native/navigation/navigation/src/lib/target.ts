import {
  getStateFromPath,
  type LinkingOptions,
  type ParamListBase,
  StackActions,
} from '@react-navigation/native';
import type { Destination, Params } from '@/lib/navigation';

export type LinkingConfig = LinkingOptions<ParamListBase>['config'];

// The first screen, and the one path every app has.
const HOME = '/';

/**
 * The screen a destination is at, and what to open it with.
 *
 * The path goes through the linking config `App.tsx` gives the container, so
 * its query becomes parameters and a `[id]` screen matches whatever is in that
 * place, as under Expo Router. Used as a screen name instead it only matches a
 * bare static path, and the stack drops an action for a screen it does not
 * have without a word in a release build.
 *
 * A path no screen is at goes to a `+not-found` screen if there is one, as
 * under Expo Router, and home otherwise: going nowhere leaves someone who has
 * just signed in looking at the form.
 *
 * Kept out of `navigation.tsx` so it can be tested without rendering a hook.
 */
export function target(
  to: Destination,
  config: LinkingConfig,
): [string, Params] {
  const [path, params] =
    typeof to === 'string' ? [to, undefined] : [to.pathname, to.params];
  const route = getStateFromPath(path, config)?.routes[0];

  if (!route) {
    if (__DEV__) {
      console.warn(`No screen is at ${path}, so going to ${HOME} instead.`);
    }

    return [HOME, {}];
  }

  return [route.name, { ...(route.params as Params | undefined), ...params }];
}

/**
 * The stack action that returns to the screen at `to`, with the parameters `to`
 * carries.
 *
 * It pops back to the nearest screen of that name beneath the current one, and
 * when there is none, as when a deep link opened the app on the current screen,
 * it takes the current screen's place.
 */
export function backTo(to: Destination, config: LinkingConfig) {
  return StackActions.popTo(...target(to, config));
}
