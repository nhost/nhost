import { type ComputedRef, computed } from 'vue';
import { useRoute } from 'vue-router';
import { signInDestination } from '@/signin/destination';

/**
 * Where the current page should land once it has signed someone in.
 *
 * Every sign-in method needs this and none of them should be re-deriving it,
 * so it lives beside `signInDestination` rather than inside any one of them.
 * The value is always a path on this site: see `destination.ts` for why that
 * takes the URL parser rather than a pattern.
 */
export function useNext(): ComputedRef<string> {
  const route = useRoute();

  return computed(() => {
    // vue-router reports a repeated parameter as an array, and a bare `?next`
    // with no value as null. `signInDestination` is what decides whether the
    // value is safe; this only has to hand it the first one as a string or
    // nothing at all.
    const raw = route.query['next'];
    const next = Array.isArray(raw) ? raw[0] : raw;

    return signInDestination(next ?? undefined);
  });
}
