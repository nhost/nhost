import { LocationTag } from '@/components/WantFields';
import { cn } from '@/lib/utils';
import { asPreposition, type Preposition } from '@/lib/want';

/**
 * The measurements a row is built from, shared so the owner's list and the
 * public page cannot drift into looking like two different products.
 *
 * The media column is *always* present, photo or not. Letting it collapse is
 * what made the list ragged: a row with a picture started its sentence 80px
 * further right than the row above it, so three rows had three different left
 * edges and nothing lined up with the field you type into. Reserved, every
 * sentence starts in the same place and the pictures form a column of their
 * own.
 */
export const ROW_MEDIA_SLOT = 'w-16 shrink-0';

/** The picture itself: a square with its own corners, never stretched. */
export const ROW_MEDIA = 'size-16 rounded-lg border';

/** How the empty slot's motif is tinted, in both lists. */
export const ROW_PLACEHOLDER =
  'size-full rounded-[inherit] bg-muted/40 text-muted-foreground/35';

/** The gap either side of the picture, so it is not crowded by its neighbours. */
export const ROW_GAP = 'gap-4';

/** A row's own vertical padding, and the hairline that separates it. */
export const ROW_DIVIDER = 'border-border/50 border-b last:border-b-0';

/** The updated-at stamp: quiet, never the thing you read first. */
export const ROW_STAMP =
  'hidden shrink-0 text-muted-foreground/50 text-xs sm:flex';

/**
 * The controls at the end of a row, as one slot of fixed width.
 *
 * Fixed rather than sized to whatever is in it, for two reasons. The eye is
 * absent while the public page is off, and reserving its width anyway is what
 * keeps the delete button in one place instead of sliding sideways the moment
 * the page is switched on. And a stable width is what lets the compose form
 * above the list end where the stamps end: `Todos.tsx` gives its Add button
 * this same width and this same trailing padding, so the field's right edge
 * lands on the stamps' right edge and the button's on the eyes' below it.
 */
export const ROW_ACTIONS =
  'flex w-[76px] shrink-0 items-center justify-end gap-1';

/** That slot's width alone, for the compose form's Add button. */
export const ROW_ACTIONS_WIDTH = 'w-[76px]';

/**
 * A row's padding at the trailing edge, which the compose form matches.
 *
 * The same 24px as `ROW_LEADING_OFFSET`, so the card's contents sit centred in
 * it: the field's left edge and the Add button's right edge are the same
 * distance from their respective borders, and so are every row's checkbox and
 * eye. At `pr-3` the right was half the left, which read as the card leaning.
 */
export const ROW_TRAILING = 'pr-6';

/**
 * The caption above a list, on both pages.
 *
 * Shared for the same reason the row measurements are: the owner's list and
 * the public page are one product, and a heading that reads one way on one of
 * them and another way on the other is how that stops being obvious.
 */
export const LIST_CAPTION =
  'text-muted-foreground text-xs uppercase tracking-[0.2em]';

/**
 * A stamp split into the two things it says: `02:25 AM` and `Sep 30, 2026`.
 *
 * Two values rather than one string because they are read at different
 * distances. Nearly every row in a list this size was touched today, so the
 * time is the part that distinguishes one from another and the date is context
 * for it - which is an order, and an order is what `Stamp` below draws.
 *
 * Fixed to `en-US` rather than the visitor's locale: the public page is
 * server-rendered and a locale-dependent string there is a hydration mismatch
 * waiting to happen, and this is a stamp rather than prose.
 */
export function stampParts(
  value: string | null | undefined,
): { time: string; date: string } | null {
  if (!value) {
    return null;
  }

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) {
    return null;
  }

  return {
    // `numeric` rather than `2-digit` for the hour: a clock face does not pad
    // to `02:33`, and neither does anyone saying the time out loud. The minute
    // stays padded, because `2:3` is not a time.
    time: at.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    date: at.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }),
  };
}

/**
 * When something last changed: the time, and the date.
 *
 * `stacked` is what a list wants. One stamp per row, read down a column, and
 * on a single line the two halves compete - the eye walks past a date it
 * already knows to reach the time it came for. Stacked, the time is what you
 * read and the date is there for when the answer is "not today". Right-aligned
 * so the stamps form an edge down the list rather than a ragged column.
 *
 * `inline` is what a sentence wants. Under the list there is one of these, and
 * it is the tail of "Last saved" rather than an entry in a column - two lines
 * there made a line of prose into a block, and the dimmer second line made it
 * look like two different things were being reported. One line, one colour.
 */
export function Stamp({
  value,
  layout = 'stacked',
  className,
}: {
  value: string | null | undefined;
  layout?: 'stacked' | 'inline';
  className?: string;
}) {
  const parts = stampParts(value);

  if (!parts) {
    return null;
  }

  if (layout === 'inline') {
    return (
      <time
        dateTime={value ?? undefined}
        className={cn('tabular-nums', className)}
      >
        {parts.time}, {parts.date}
      </time>
    );
  }

  return (
    <time
      dateTime={value ?? undefined}
      className={cn(
        'flex flex-col items-end leading-tight tabular-nums',
        className,
      )}
    >
      <span>{parts.time}</span>
      <span className="text-[0.9em] opacity-70">{parts.date}</span>
    </time>
  );
}

/**
 * How far the checkboxes sit from the card's padding, which the caption and the
 * compose field above the list both match so the three share a left edge.
 *
 * The checkbox rather than the picture beside it, because the checkbox is the
 * leftmost thing a settled row actually shows - the reorder gutter before it
 * is invisible until you point at the row. Lining the field up with the
 * pictures instead put its left edge 36px right of everything the eye reads as
 * the start of a row, which a rounded field made plainer still: two curves,
 * one under the other, visibly not on the same line.
 *
 * Stated as one number because it is the sum of two: the reorder gutter (20px)
 * and the gap after it (4px). Change either and this has to move with them.
 */
export const ROW_LEADING_OFFSET = 'pl-6';

/** The two widths `ROW_LEADING_OFFSET` adds up, kept where they can be read. */
export const ROW_LEADING_PARTS = {
  gutter: 20,
  gutterGap: 4,
} as const;

/** One type size for the sentence, on both pages. */
export const ROW_SENTENCE = 'text-base leading-snug sm:text-lg';

/**
 * "I want to <something> <somewhere>", as both pages render it.
 *
 * Shared because the two used to write the sentence out separately, and the
 * copies drifted: the owner's list said it in `text-sm` while the public page
 * said it three sizes larger, so the same row read as two different things
 * depending on who was looking. Only the size differs now, and it differs
 * where it is passed in rather than where the words are assembled.
 *
 * The strike-through goes on the whole sentence rather than the title alone:
 * `text-decoration` carries to inline children, so the opening and the place
 * go with it.
 */
export function WantSentence({
  title,
  preposition,
  location,
  completed,
  className,
}: {
  title: string;
  preposition: Preposition | string;
  location: string | null;
  completed: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        completed && 'text-muted-foreground line-through',
        className,
      )}
    >
      <span className="text-muted-foreground">I want to </span>
      {title}
      {location ? (
        <>
          <span className="text-muted-foreground">
            {' '}
            {asPreposition(preposition)}{' '}
          </span>
          <LocationTag>{location}</LocationTag>
        </>
      ) : null}
    </span>
  );
}
