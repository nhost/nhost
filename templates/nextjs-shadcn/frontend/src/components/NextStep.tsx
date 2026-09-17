import Link from 'next/link';

/**
 * Where to go once the three tiles are all green.
 *
 * The tiles report state; this says what to do about it. Only shown to someone
 * signed in, because signing in is the next step until then and the tile above
 * already offers it.
 */
export function NextStep() {
  return (
    <p className="text-muted-foreground text-sm">
      Next: read and write your own rows on the{' '}
      <Link
        href="/protected"
        className="text-foreground underline underline-offset-4"
      >
        protected page
      </Link>
      , or change your name, avatar and password on your{' '}
      <Link
        href="/profile"
        className="text-foreground underline underline-offset-4"
      >
        profile
      </Link>
      .
    </p>
  );
}
