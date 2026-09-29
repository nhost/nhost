/**
 * What a shared page offers when nothing has been shared on it yet.
 *
 * A page that is on but empty is the normal state of a new account, and
 * "no rows" is a true but charmless thing to show a visitor who followed a
 * link to it. These are the filler: short, and about doing something rather
 * than about the app.
 *
 * Five, so a refresh is not the same page twice running. Each is attributed,
 * because an unattributed quotation reads as the product talking.
 */
const QUOTES = [
  { text: 'He not busy being born is busy dying.', who: 'Bob Dylan' },
  {
    text: 'The journey of a thousand miles begins with a single step.',
    who: 'Lao Tzu',
  },
  {
    text: "Life is what happens to you while you're busy making other plans.",
    who: 'John Lennon',
  },
  { text: 'Well done is better than well said.', who: 'Benjamin Franklin' },
  {
    text: 'Act as if what you do makes a difference. It does.',
    who: 'William James',
  },
] as const;

/**
 * The empty list, with one of the quotations above picked per request.
 *
 * A server component, and picked during render rather than in an effect. The
 * page this sits on is `force-dynamic`, so it is rendered afresh on every
 * visit and this is a new quotation on every refresh - with none of what a
 * client component would have cost here, which is shipping the list to the
 * browser and showing the first one for a frame before swapping it.
 */
export function EmptyList() {
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)] ?? QUOTES[0];

  return (
    <div className="flex flex-col items-center gap-5 px-6 py-16 text-center">
      <p className="text-muted-foreground text-sm">Nothing here yet.</p>

      <figure className="flex max-w-sm flex-col gap-2">
        <blockquote className="text-pretty text-muted-foreground/70 text-sm italic">
          &ldquo;{quote.text}&rdquo;
        </blockquote>
        <figcaption className="text-muted-foreground/50 text-xs">
          &mdash; {quote.who}
        </figcaption>
      </figure>
    </div>
  );
}
