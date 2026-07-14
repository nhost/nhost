import { SCORE_BANDS, scoreNode } from '@/features/command-palette/lib/score';
import type { CommandNode } from '@/features/command-palette/types';

const makeNode = (overrides: Partial<CommandNode>): CommandNode => ({
  id: 'node',
  title: 'Remote Schemas',
  kind: 'page',
  ...overrides,
});

describe('scoreNode', () => {
  it('orders the match ladder from strongest to weakest', () => {
    expect(scoreNode('rem', makeNode({ title: 'Remote Schemas' })).score).toBe(
      SCORE_BANDS.TITLE_PREFIX,
    );
    expect(scoreNode('mote', makeNode({ title: 'Remote Schemas' })).score).toBe(
      SCORE_BANDS.SUBSTRING,
    );
    expect(scoreNode('sch', makeNode({ title: 'Remote Schemas' })).score).toBe(
      SCORE_BANDS.WORD_PREFIX,
    );
    expect(
      scoreNode(
        'remote graph',
        makeNode({
          title: 'Remote Schemas',
          keywords: ['remote graphql schema'],
        }),
      ).score,
    ).toBe(SCORE_BANDS.ALL_TOKENS_PRESENT);
    expect(
      scoreNode('shemas', makeNode({ title: 'Remote Schemas' })).score,
    ).toBe(SCORE_BANDS.TYPO);

    expect(SCORE_BANDS.TITLE_PREFIX).toBeGreaterThan(SCORE_BANDS.SUBSTRING);
    expect(SCORE_BANDS.SUBSTRING).toBeGreaterThan(SCORE_BANDS.WORD_PREFIX);
    expect(SCORE_BANDS.WORD_PREFIX).toBeGreaterThan(
      SCORE_BANDS.ALL_TOKENS_PRESENT,
    );
    expect(SCORE_BANDS.ALL_TOKENS_PRESENT).toBeGreaterThan(SCORE_BANDS.TYPO);
  });

  it('tolerates one edit per token of four or more characters', () => {
    expect(scoreNode('nost', makeNode({ title: 'nhost' }))).toEqual({
      score: SCORE_BANDS.TYPO,
      titleRanges: [[0, 5]],
    });
    expect(scoreNode('nhsot', makeNode({ title: 'nhost' })).score).toBe(
      SCORE_BANDS.TYPO,
    );
    expect(scoreNode('nhist', makeNode({ title: 'nhost' })).score).toBe(
      SCORE_BANDS.TYPO,
    );
    expect(
      scoreNode(
        'roles permisions',
        makeNode({ title: 'Roles and Permissions' }),
      ),
    ).toEqual({
      score: SCORE_BANDS.TYPO,
      titleRanges: [
        [0, 5],
        [10, 21],
      ],
    });
    expect(
      scoreNode(
        'postgers',
        makeNode({ title: 'Database', keywords: ['postgres'] }),
      ),
    ).toEqual({
      score: SCORE_BANDS.TYPO,
      titleRanges: [],
    });
  });

  it('rejects scattered subsequences and short-token near-misses', () => {
    expect(
      scoreNode('demo', makeNode({ title: 'Roles and Permissions' })).score,
    ).toBe(SCORE_BANDS.NONE);
    expect(
      scoreNode('de', makeNode({ title: 'Table Editor & Browser' })).score,
    ).toBe(SCORE_BANDS.NONE);
    expect(scoreNode('dme', makeNode({ title: 'demo' })).score).toBe(
      SCORE_BANDS.NONE,
    );
    expect(scoreNode('rms', makeNode({ title: 'Remote Schemas' })).score).toBe(
      SCORE_BANDS.NONE,
    );
  });

  it('returns title ranges for title matches', () => {
    expect(scoreNode('mote', makeNode({ title: 'Remote Schemas' }))).toEqual({
      score: SCORE_BANDS.SUBSTRING,
      titleRanges: [[2, 6]],
    });
  });

  it('scores keyword-only matches without title ranges', () => {
    expect(
      scoreNode(
        'postgres',
        makeNode({ title: 'Database', keywords: ['postgres sql'] }),
      ),
    ).toEqual({
      score: SCORE_BANDS.WORD_PREFIX,
      titleRanges: [],
    });
  });

  it('returns zero for non-matches and blank queries', () => {
    expect(scoreNode('xyz', makeNode({ title: 'Remote Schemas' }))).toEqual({
      score: SCORE_BANDS.NONE,
      titleRanges: [],
    });
    expect(scoreNode(' ', makeNode({ title: 'Remote Schemas' }))).toEqual({
      score: SCORE_BANDS.NONE,
      titleRanges: [],
    });
  });
});
