/**
 * An item is something you want to do, optionally somewhere in particular.
 *
 * "I want to go skateboarding" and "I want to go skateboarding in Los Angeles,
 * California" are the same row; the second one filled the location in. The
 * preposition joining them is the user's choice because no single word fits
 * every case: you skate *in* a city, stay *at* a hotel, and watch the lights
 * *from* a hillside.
 */

/**
 * Three words cover almost everything: you skate *in* a city, stay *at* a
 * hotel, and watch the lights *from* a hillside. The list is deliberately
 * short, because a longer one is a menu to read rather than a word to pick.
 */
export const PREPOSITIONS = ['in', 'at', 'from'] as const;

export type Preposition = (typeof PREPOSITIONS)[number];

export const DEFAULT_PREPOSITION: Preposition = 'in';

export type Want = {
  title: string;
  preposition: string;
  location: string | null;
};

/**
 * Narrows the column, which is plain `text` with no check constraint.
 *
 * The set of prepositions is presentation rather than something the app
 * branches on, and it is the kind of list that grows, so it is narrowed here
 * instead of in the database where widening it would cost a migration.
 */
export const asPreposition = (value: string | null | undefined): Preposition =>
  (PREPOSITIONS as readonly string[]).includes(value ?? '')
    ? (value as Preposition)
    : DEFAULT_PREPOSITION;

/** "go skateboarding in Los Angeles, California", without the opening. */
export const wantPhrase = (want: Want): string => {
  const location = want.location?.trim();

  return location
    ? `${want.title} ${asPreposition(want.preposition)} ${location}`
    : want.title;
};

/** The whole sentence, for a page title or anywhere outside the list. */
export const wantSentence = (want: Want): string =>
  `I want to ${wantPhrase(want)}`;
