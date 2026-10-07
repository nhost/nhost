import { useSearchParams } from 'react-router';
import { signInDestination } from '@/signin/destination';

/**
 * Where the current page should land once it has signed someone in.
 *
 * Every sign-in method needs this and none of them should be re-deriving it,
 * so it lives beside `signInDestination` rather than inside any one of them.
 * The value is always a path on this site: see `destination.ts` for why that
 * takes the URL parser rather than a pattern.
 */
export function useNext(): string {
  const [params] = useSearchParams();

  return signInDestination(params.get('next') ?? undefined);
}
