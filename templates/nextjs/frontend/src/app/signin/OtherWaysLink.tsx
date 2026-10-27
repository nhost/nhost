import Link from 'next/link';
import { buttons, methods } from '@/app/signin/methods';

/**
 * Sends the visitor back to the list of sign-in methods, when there is a list
 * worth going back to.
 */
export default function OtherWaysLink({ query }: { query: string }) {
  if (methods.length + buttons.length < 2) {
    return null;
  }

  return (
    // self-center, since every page that uses this stacks its card content in a
    // column: a flex item stretches by default, which left the link against the
    // edge of a card whose heading is centred.
    <Link
      href={`/signin${query}`}
      className="self-center text-muted-foreground text-sm underline-offset-4 hover:underline"
    >
      Other ways to sign in
    </Link>
  );
}
