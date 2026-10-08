import { useParams } from '@/lib/navigation';
import { type Intent, signInIntent } from '@/signin/intent';

/**
 * Whether the link that opened this screen asked to sign up or to sign in.
 *
 * Beside `useNext` for the same reason: every method that opens a form needs
 * it, and none of them should be re-deriving it. Read through the navigation
 * seam, so it works under either navigation system.
 */
export function useIntent(): Intent {
  const { intent } = useParams<{ intent: string }>();

  return signInIntent(intent);
}
