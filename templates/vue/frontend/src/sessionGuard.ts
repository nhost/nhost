import {
  type RouteLocationNormalized,
  type Router,
  START_LOCATION,
} from 'vue-router';
import {
  promoteSignInAttempt,
  recordSignInAttempt,
} from '@/app/signin/lastUsed';
import { guard } from '@/guard';
import { nhost } from '@/lib/nhost/client';
import { pendingPasswordReset } from '@/lib/nhost/passwordReset';

// Where a visit to `to` goes instead, if anywhere, once what it says about
// signing in is noted.
function check(to: RouteLocationNormalized): string | undefined {
  const verdict = guard({
    path: to.path,
    search: new URL(to.fullPath, 'https://placeholder.invalid').search,
    signedIn: !!nhost.getUserSession(),
    pendingReset: pendingPasswordReset(),
  });

  if (verdict.record) {
    recordSignInAttempt(verdict.record);
  }
  if (verdict.promote) {
    promoteSignInAttempt();
  }

  return verdict.redirect;
}

/**
 * Runs `guard` before every navigation, so a page the visitor may not see
 * never renders. A session that ends in this tab does not run it again:
 * whatever ended it navigates on its own. Returns `recheck`, which runs it on
 * the page already showing, for a change this tab did not make.
 */
export function guardRoutes(router: Router): VoidFunction {
  router.beforeEach((to) => check(to) ?? true);

  return () => {
    const current = router.currentRoute.value;
    if (current === START_LOCATION) {
      return;
    }
    const redirect = check(current);
    if (redirect) {
      void router.replace(redirect);
    }
  };
}
