import type { CommandNode } from '@/features/command-palette/types';

export const SCORE_BANDS = {
  TITLE_PREFIX: 500,
  SUBSTRING: 400,
  WORD_PREFIX: 300,
  ALL_TOKENS_PRESENT: 200,
  SUBSEQUENCE: 100,
  NONE: 0,
} as const;

export type TitleRange = [start: number, end: number];

export interface ScoreResult {
  score: number;
  titleRanges: TitleRange[];
}

type Candidate = {
  value: string;
  isTitle: boolean;
};

const normalize = (value: string) => value.trim().toLowerCase();

const getCandidates = (node: CommandNode): Candidate[] => [
  { value: node.title, isTitle: true },
  ...(node.keywords ?? []).map((value) => ({ value, isTitle: false })),
];

const getNonWordPrefixSubstringRange = (
  value: string,
  query: string,
): TitleRange[] => {
  const normalizedValue = normalize(value);
  let searchStart = 0;

  while (searchStart < normalizedValue.length) {
    const index = normalizedValue.indexOf(query, searchStart);

    if (index < 0) {
      return [];
    }

    const previousCharacter = normalizedValue[index - 1];

    if (index > 0 && previousCharacter && /\S/.test(previousCharacter)) {
      return [[index, index + query.length]];
    }

    searchStart = index + 1;
  }

  return [];
};

const getWordPrefixRange = (value: string, query: string): TitleRange[] => {
  const normalizedValue = normalize(value);
  const match = normalizedValue.match(/\S+/g);

  if (!match) {
    return [];
  }

  let searchStart = 0;

  for (const word of match) {
    const index = normalizedValue.indexOf(word, searchStart);
    searchStart = index + word.length;

    if (word.startsWith(query)) {
      return [[index, index + query.length]];
    }
  }

  return [];
};

const getAllTokenRanges = (value: string, tokens: string[]): TitleRange[] => {
  const normalizedValue = normalize(value);
  const ranges: TitleRange[] = [];

  for (const token of tokens) {
    const index = normalizedValue.indexOf(token);

    if (index < 0) {
      return [];
    }

    ranges.push([index, index + token.length]);
  }

  return mergeRanges(ranges);
};

const getSubsequenceRanges = (value: string, query: string): TitleRange[] => {
  const normalizedValue = normalize(value);
  const ranges: TitleRange[] = [];
  let queryIndex = 0;

  for (
    let valueIndex = 0;
    valueIndex < normalizedValue.length;
    valueIndex += 1
  ) {
    if (normalizedValue[valueIndex] !== query[queryIndex]) {
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

const candidateHasAllTokens = (candidate: string, tokens: string[]) => {
  const normalizedCandidate = normalize(candidate);

  return tokens.every((token) => normalizedCandidate.includes(token));
};

const candidateHasSubsequence = (candidate: string, query: string) =>
  getSubsequenceRanges(candidate, query).length > 0;

const getBestCandidateScore = (
  query: string,
  tokens: string[],
  node: CommandNode,
) => {
  const candidates = getCandidates(node);

  if (normalize(node.title).startsWith(query)) {
    return SCORE_BANDS.TITLE_PREFIX;
  }

  if (
    candidates.some(
      ({ value }) => getNonWordPrefixSubstringRange(value, query).length > 0,
    )
  ) {
    return SCORE_BANDS.SUBSTRING;
  }

  if (
    candidates.some(({ value }) => getWordPrefixRange(value, query).length > 0)
  ) {
    return SCORE_BANDS.WORD_PREFIX;
  }

  if (candidates.some(({ value }) => candidateHasAllTokens(value, tokens))) {
    return SCORE_BANDS.ALL_TOKENS_PRESENT;
  }

  if (candidates.some(({ value }) => candidateHasSubsequence(value, query))) {
    return SCORE_BANDS.SUBSEQUENCE;
  }

  return SCORE_BANDS.NONE;
};

const getTitleRangesForScore = (
  title: string,
  query: string,
  tokens: string[],
  score: number,
): TitleRange[] => {
  if (score === SCORE_BANDS.TITLE_PREFIX) {
    return [[0, query.length]];
  }

  if (score === SCORE_BANDS.SUBSTRING) {
    return getNonWordPrefixSubstringRange(title, query);
  }

  if (score === SCORE_BANDS.WORD_PREFIX) {
    return getWordPrefixRange(title, query);
  }

  if (score === SCORE_BANDS.ALL_TOKENS_PRESENT) {
    return getAllTokenRanges(title, tokens);
  }

  if (score === SCORE_BANDS.SUBSEQUENCE) {
    return getSubsequenceRanges(title, query);
  }

  return [];
};

export const scoreNode = (query: string, node: CommandNode): ScoreResult => {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return { score: SCORE_BANDS.NONE, titleRanges: [] };
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const score = getBestCandidateScore(normalizedQuery, tokens, node);
  const titleRanges = getTitleRangesForScore(
    node.title,
    normalizedQuery,
    tokens,
    score,
  );

  return { score, titleRanges };
};
