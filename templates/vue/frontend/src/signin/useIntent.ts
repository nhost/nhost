import { type ComputedRef, computed } from 'vue';
import { useRoute } from 'vue-router';
import { type Intent, signInIntent } from '@/signin/intent';

/**
 * Whether the link that opened this page asked to sign up or to sign in.
 *
 * Beside `useNext` for the same reason: every method that opens a form needs
 * it, and none of them should be re-deriving it.
 */
export function useIntent(): ComputedRef<Intent> {
  const route = useRoute();

  return computed(() => {
    const raw = route.query['intent'];
    const intent = Array.isArray(raw) ? raw[0] : raw;

    return signInIntent(intent ?? undefined);
  });
}
