import { useParams } from '@/lib/navigation';
import { signInDestination } from '@/signin/destination';

/**
 * Where the current screen should land once it has signed someone in.
 *
 * Every sign-in method needs this and none of them should be re-deriving it,
 * so it lives beside `signInDestination` rather than inside any one of them.
 * The value is always a path inside this app: see `destination.ts` for why
 * that takes the URL parser rather than a pattern. It matters here for the
 * same reason as on the web, because a deep link can carry any `next` someone
 * cares to put in it.
 */
export function useNext(): string {
  const { next } = useParams<{ next: string }>();

  return signInDestination(next);
}
