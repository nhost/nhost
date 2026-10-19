import Link from 'next/link';
import { methods } from '@/app/signin/methods';

/**
 * Sends the visitor back to the list of sign-in methods, when there is a list
 * worth going back to.
 *
 * A project may keep a single method, and `methods.ts` is the only thing that
 * knows how many there are. With one, the sign-in page offers nothing this
 * page does not already show, so the link would promise choices that do not
 * exist.
 *
 * It reads `methods.ts` rather than naming any method, which is what keeps it
 * shared: deleting a method changes the count and nothing here.
 */
export default function OtherWaysLink({ query }: { query: string }) {
  if (methods.length < 2) {
    return null;
  }

  return (
    // self-center, since every page that uses this stacks its card content
    // in a column: a flex item stretches by default, which left the link
    // against the edge of a card whose heading is centred.
    <Link
      href={`/signin${query}`}
      className="self-center text-muted-foreground text-sm underline-offset-4 hover:underline"
    >
      Other ways to sign in
    </Link>
  );
}
