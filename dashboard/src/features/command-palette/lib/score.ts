import type { CommandNode, TitleRange } from '@/features/command-palette/types';

export const SCORE_BANDS = {
  TITLE_PREFIX: 500,
  SUBSTRING: 400,
  WORD_PREFIX: 300,
  ALL_TOKENS_PRESENT: 200,
  SUBSEQUENCE: 100,
  NONE: 0,
} as const;

interface ScoreResult {
  score: number;
  titleRanges: TitleRange[];
}

const normalize = (value: string) => value.trim().toLowerCase();

interface NodeCandidates {
  title: string;
  keywords: string[];
}

// Nodes are treated as immutable: normalized candidates are cached per node
// identity, so a node whose title/keywords change must be a new object.
const candidatesCache = new WeakMap<CommandNode, NodeCandidates>();

const getCandidates = (node: CommandNode): NodeCandidates => {
  const cached = candidatesCache.get(node);

  if (cached) {
    return cached;
  }

  const candidates = {
    title: normalize(node.title),
    keywords: (node.keywords ?? []).map(normalize),
  };
  candidatesCache.set(node, candidates);

  return candidates;
};

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

const getWordPrefixRange = (value: string, query: string): TitleRange[] => {
  const match = value.match(/\S+/g);

  if (!match) {
    return [];
  }

  let searchStart = 0;

  for (const word of match) {
    const index = value.indexOf(word, searchStart);
    searchStart = index + word.length;

    if (word.startsWith(query)) {
      return [[index, index + query.length]];
    }
  }

  return [];
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

const getSubsequenceRanges = (value: string, query: string): TitleRange[] => {
  const ranges: TitleRange[] = [];
  let queryIndex = 0;

  for (let valueIndex = 0; valueIndex < value.length; valueIndex += 1) {
    if (value[valueIndex] !== query[queryIndex]) {
      continue;
    }

    ranges.push([valueIndex, valueIndex + 1]);
    queryIndex += 1;

    if (queryIndex === query.length) {
      return mergeRanges(ranges);
    }
  }

  return [];
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
    score: SCORE_BANDS.SUBSEQUENCE,
    getRanges: (value, query) => getSubsequenceRanges(value, query),
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
  const { title, keywords } = getCandidates(node);

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
