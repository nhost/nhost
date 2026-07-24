import type { CommandNode, TitleRange } from '@/features/command-palette/types';

export const SCORE_BANDS = {
  TITLE_PREFIX: 500,
  SUBSTRING: 400,
  WORD_PREFIX: 300,
  ALL_TOKENS_PRESENT: 200,
  TYPO: 100,
  NONE: 0,
} as const;

// Tokens shorter than this get no typo tolerance; near-misses on very short
// queries match almost everything.
const MIN_TYPO_TOKEN_LENGTH = 4;

interface ScoreResult {
  score: number;
  titleRanges: TitleRange[];
}

const normalize = (value: string) => value.trim().toLowerCase();

const getNonWordPrefixSubstringRange = (
  value: string,
  query: string,
): TitleRange[] => {
  let searchStart = 0;

  while (searchStart < value.length) {
    const index = value.indexOf(query, searchStart);

    if (index < 0) {
      return [];
    }

    const previousCharacter = value[index - 1];

    if (index > 0 && previousCharacter && /\S/.test(previousCharacter)) {
      return [[index, index + query.length]];
    }

    searchStart = index + 1;
  }

  return [];
};

interface TitleWord {
  text: string;
  start: number;
}

const getWords = (value: string): TitleWord[] => {
  const words: TitleWord[] = [];
  let searchStart = 0;

  for (const text of value.match(/\S+/g) ?? []) {
    const start = value.indexOf(text, searchStart);
    words.push({ text, start });
    searchStart = start + text.length;
  }

  return words;
};

const getWordPrefixRange = (value: string, query: string): TitleRange[] => {
  const word = getWords(value).find(({ text }) => text.startsWith(query));

  return word ? [[word.start, word.start + query.length]] : [];
};

const getAllTokenRanges = (value: string, tokens: string[]): TitleRange[] => {
  const ranges: TitleRange[] = [];

  for (const token of tokens) {
    const index = value.indexOf(token);

    if (index < 0) {
      return [];
    }

    ranges.push([index, index + token.length]);
  }

  return mergeRanges(ranges);
};

// One substitution, insertion, deletion, or adjacent transposition.
const isWithinOneEdit = (first: string, second: string): boolean => {
  if (first === second) {
    return true;
  }

  const lengthDiff = first.length - second.length;

  if (Math.abs(lengthDiff) > 1) {
    return false;
  }

  if (lengthDiff !== 0) {
    const longer = lengthDiff > 0 ? first : second;
    const shorter = lengthDiff > 0 ? second : first;
    let index = 0;

    while (index < shorter.length && longer[index] === shorter[index]) {
      index += 1;
    }

    return longer.slice(index + 1) === shorter.slice(index);
  }

  let mismatch = -1;

  for (let index = 0; index < first.length; index += 1) {
    if (first[index] === second[index]) {
      continue;
    }

    if (mismatch >= 0) {
      return (
        mismatch === index - 1 &&
        first[mismatch] === second[index] &&
        first[index] === second[mismatch] &&
        first.slice(index + 1) === second.slice(index + 1)
      );
    }

    mismatch = index;
  }

  return true;
};

const getTypoTokenRange = (
  value: string,
  words: TitleWord[],
  token: string,
): TitleRange | undefined => {
  if (token.length < MIN_TYPO_TOKEN_LENGTH) {
    const index = value.indexOf(token);

    return index < 0 ? undefined : [index, index + token.length];
  }

  const word = words.find(({ text }) => isWithinOneEdit(token, text));

  return word ? [word.start, word.start + word.text.length] : undefined;
};

const getTypoRanges = (value: string, tokens: string[]): TitleRange[] => {
  const words = getWords(value);
  const ranges: TitleRange[] = [];

  for (const token of tokens) {
    const range = getTypoTokenRange(value, words, token);

    if (!range) {
      return [];
    }

    ranges.push(range);
  }

  return mergeRanges(ranges);
};

const mergeRanges = (ranges: TitleRange[]): TitleRange[] => {
  const sortedRanges = [...ranges].sort(
    (first, second) => first[0] - second[0],
  );
  const result: TitleRange[] = [];

  for (const range of sortedRanges) {
    const previous = result.at(-1);

    if (previous && range[0] <= previous[1]) {
      previous[1] = Math.max(previous[1], range[1]);
      continue;
    }

    result.push([...range]);
  }

  return result;
};

interface BandMatcher {
  score: number;
  getRanges: (value: string, query: string, tokens: string[]) => TitleRange[];
  // Only the title can win this band; keywords are not consulted.
  titleOnly?: boolean;
}

// Ordered strongest band first; the first band matched by the title or any
// keyword wins, and the title's ranges from that same band drive highlighting
// (empty when only a keyword matched).
const bandMatchers: BandMatcher[] = [
  {
    score: SCORE_BANDS.TITLE_PREFIX,
    titleOnly: true,
    getRanges: (value, query) =>
      value.startsWith(query) ? [[0, query.length]] : [],
  },
  {
    score: SCORE_BANDS.SUBSTRING,
    getRanges: (value, query) => getNonWordPrefixSubstringRange(value, query),
  },
  {
    score: SCORE_BANDS.WORD_PREFIX,
    getRanges: (value, query) => getWordPrefixRange(value, query),
  },
  {
    score: SCORE_BANDS.ALL_TOKENS_PRESENT,
    getRanges: (value, _query, tokens) => getAllTokenRanges(value, tokens),
  },
  {
    score: SCORE_BANDS.TYPO,
    getRanges: (value, _query, tokens) => getTypoRanges(value, tokens),
  },
];

export const scoreNode = (query: string, node: CommandNode): ScoreResult => {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return { score: SCORE_BANDS.NONE, titleRanges: [] };
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  // All range helpers expect pre-normalized values; ranges index into the
  // normalized string, which only lines up with the raw title because titles
  // carry no leading whitespace.
  const title = normalize(node.title);
  const keywords = (node.keywords ?? []).map(normalize);

  for (const matcher of bandMatchers) {
    const titleRanges = matcher.getRanges(title, normalizedQuery, tokens);

    if (titleRanges.length > 0) {
      return { score: matcher.score, titleRanges };
    }

    if (
      !matcher.titleOnly &&
      keywords.some(
        (keyword) =>
          matcher.getRanges(keyword, normalizedQuery, tokens).length > 0,
      )
    ) {
      return { score: matcher.score, titleRanges: [] };
    }
  }

  return { score: SCORE_BANDS.NONE, titleRanges: [] };
};
