import { signInDestination, signInHref } from '@/screens/signin/destination';

const protectedRoutes = ['/account'];

// The pages that sign a visitor in: the list of methods, and each method's own
// page, which `methods.ts` puts at `/auth/<method>`.
const METHOD_PAGE = /^\/auth\/[^/]+\/?$/;
const isSignInPage = (path: string): boolean =>
  path === '/signin' || METHOD_PAGE.test(path);

// What the auth service appends to `redirectTo` when a flow fails.
const authErrorParams = ['error', 'errorDescription'];

// A failed flow sends a signed-out visitor back to the page they started from,
// so the reason arrives here.
function signInRedirect(path: string, search: string): string {
  const kept = new URLSearchParams(search);
  const lifted = new URLSearchParams();
  for (const name of authErrorParams) {
    const value = kept.get(name);
    if (value !== null) {
      lifted.set(name, value);
    }
    kept.delete(name);
  }

  // Not `size`: see `signInQuery`.
  const liftedQuery = lifted.toString();
  if (liftedQuery === '') {
    return signInHref(`${path}${search}`);
  }

  const rest = kept.toString();
  return `${signInHref(`${path}${rest === '' ? '' : `?${rest}`}`)}&${liftedQuery}`;
}

export type GuardInput = {
  path: string;
  search: string;
  signedIn: boolean;
  // The reset page a password-reset link signed this browser in on, while the
  // new password is still to be saved.
  pendingReset: string | null;
};

export type GuardResult = {
  redirect?: string;
  // A method page a signed-out visitor opened.
  record?: string;
  // Signed in, so the attempt, if any, is how.
  promote?: boolean;
};

/** Where a visit to `path` goes instead, and what it says about signing in. */
export function guard({
  path,
  search,
  signedIn,
  pendingReset,
}: GuardInput): GuardResult {
  const result: GuardResult = {};
  if (signedIn) {
    result.promote = true;
  } else if (METHOD_PAGE.test(path)) {
    result.record = path.replace(/\/$/, '');
  }

  // A reset link signed this visitor in so they could choose a new password,
  // not so they could use the account with the old one forgotten. A marker
  // that outlived its session means nothing.
  if (signedIn && pendingReset) {
    const resetPage = signInDestination(pendingReset);
    if (path !== resetPage) {
      result.redirect = resetPage;
    }
    return result;
  }

  const isProtectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );

  if (isProtectedRoute && !signedIn) {
    result.redirect = signInRedirect(path, search);
    return result;
  }

  // Someone already signed in has nothing to do on a sign-in page, so they go
  // on to where it would have sent them.
  if (isSignInPage(path) && signedIn) {
    result.redirect = signInDestination(
      new URLSearchParams(search).get('next') ?? undefined,
    );
  }

  return result;
}
