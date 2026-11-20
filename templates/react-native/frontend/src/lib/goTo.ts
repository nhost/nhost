import { router, useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';

type Container = ReturnType<typeof useNavigationContainerRef>;

type State = {
  type?: string;
  index?: number;
  routes: { state?: State }[];
};

let container: Container | null = null;

/** Lets `goTo` read the navigation state; `AuthProvider` calls it. */
export function useGoTo(): void {
  const ref = useNavigationContainerRef();
  useEffect(() => {
    container = ref;
    return () => {
      container = null;
    };
  }, [ref]);
}

// `dismissAll` empties the innermost stack along the focused route that has a
// screen to dismiss, and only that one, so it takes one per such stack.
function stacksToEmpty(state: State | undefined): number {
  let count = 0;
  for (let at = state; at; at = at.routes[at.index ?? 0]?.state) {
    if ((at.type ?? 'stack') === 'stack' && (at.index ?? 0) > 0) {
      count++;
    }
  }
  return count;
}

/**
 * Opens `href` with nothing under it, nested stacks included: a session that
 * starts or ends leaves no screen behind to go back to.
 */
export function goTo(href: string): void {
  const count = stacksToEmpty(container?.getRootState() as State | undefined);
  for (let n = 0; n < count; n++) {
    router.dismissAll();
  }
  router.replace(href);
}
