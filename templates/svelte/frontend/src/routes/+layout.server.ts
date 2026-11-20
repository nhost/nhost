import { SESSION_DEPENDENCY } from '#lib/components/refreshOnFocus.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ depends, locals, url }) => {
  depends(SESSION_DEPENDENCY);

  // Reading the URL makes every navigation load this again, from the server,
  // so each one passes through src/hooks.server.ts and its session checks as a
  // full page load does.
  void url.href;

  return { user: locals.session?.user ?? null };
};
