import { useSearchParams } from 'react-router';
import { type Intent, signInIntent } from '@/signin/intent';

/**
 * Whether the link that opened this page asked to sign up or to sign in.
 *
 * Beside `useNext` for the same reason: every method that opens a form needs
 * it, and none of them should be re-deriving it.
 */
export function useIntent(): Intent {
  const [params] = useSearchParams();

  return signInIntent(params.get('intent') ?? undefined);
}
