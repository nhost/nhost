import type { StoredSession } from '@nhost/nhost-js/session';
import {
  type App,
  type ComputedRef,
  computed,
  type InjectionKey,
  inject,
  type Plugin,
  ref,
  shallowRef,
} from 'vue';
import { type Router, START_LOCATION } from 'vue-router';
import { nhost } from './client';
import { watchSession } from './watchSession';

export type Auth = {
  session: ComputedRef<StoredSession | null>;
  // Bumped whenever pages have to load their data again.
  load: ComputedRef<number>;
  refresh: VoidFunction;
};

const AUTH: InjectionKey<Auth> = Symbol('auth');

export function useAuth(): Auth {
  const auth = inject(AUTH);
  if (!auth) {
    throw new Error('useAuth() needs the app to use createAuth()');
  }
  return auth;
}

/** The session as this tab knows it, for whatever shows who is signed in. */
export const useSession = (): ComputedRef<StoredSession | null> =>
  useAuth().session;

/**
 * Holds the session for the app and follows it for as long as it is mounted.
 * `recheck` runs the session guard again on the page already showing.
 */
export function createAuth({
  router,
  recheck,
}: {
  router: Router;
  recheck: VoidFunction;
}): Plugin {
  return {
    install(app: App) {
      const session = shallowRef(nhost.getUserSession());
      const load = ref(0);
      const refresh = (): void => {
        load.value += 1;
        recheck();
      };

      const watching = watchSession({
        onSession: (current) => {
          session.value = current;
        },
        onRecheck: recheck,
        onRefresh: refresh,
      });

      // Startup has just checked the first page, so only later navigations
      // check.
      const stopChecking = router.afterEach((_to, from, failure) => {
        if (!failure && from !== START_LOCATION) {
          void watching.checkRevoked();
        }
      });

      app.onUnmount(() => {
        watching.stop();
        stopChecking();
      });

      app.provide(AUTH, {
        session: computed(() => session.value),
        load: computed(() => load.value),
        refresh,
      });
    },
  };
}
