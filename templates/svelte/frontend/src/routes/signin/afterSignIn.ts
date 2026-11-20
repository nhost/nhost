import { goto } from '$app/navigation';

/**
 * Goes on to `next` once a form has signed the visitor in. SvelteKit keeps a
 * remote query's answer after its page goes, until the browser collects it,
 * so a plain `goto` could show the account page what its queries said while
 * signed out. `refreshAll` drops those answers and runs every load again,
 * which also updates the nav.
 */
export const afterSignIn = (next: string): Promise<void> =>
  goto(next, { refreshAll: true });
