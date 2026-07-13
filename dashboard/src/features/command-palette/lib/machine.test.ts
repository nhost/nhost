import {
  commandPaletteReducer,
  getScopeRoot,
  getSearchCandidates,
  getVisibleItems,
  initialCommandPaletteState,
} from '@/features/command-palette/lib/machine';
import type { CommandNode } from '@/features/command-palette/types';

const tree: CommandNode = {
  id: 'root',
  title: 'Root',
  kind: 'group',
  children: [
    {
      id: 'project-pages',
      title: 'Project pages',
      kind: 'group',
      children: [
        {
          id: 'database',
          title: 'Database',
          kind: 'group',
          keywords: ['tables'],
          children: [
            {
              id: 'database-browser',
              title: 'Table Browser',
              kind: 'page',
              path: 'database/browser/default',
              scope: 'project',
              keywords: ['database rows'],
            },
          ],
        },
        {
          id: 'graphql',
          title: 'GraphQL',
          kind: 'page',
          path: 'graphql',
          scope: 'project',
        },
      ],
    },
    {
      id: 'docs',
      title: 'Docs',
      kind: 'doc',
      path: 'https://docs.nhost.io',
      scope: 'external',
    },
  ],
};

const projectPages = tree.children?.[0] as CommandNode;
const database = projectPages.children?.[0] as CommandNode;
const graphql = projectPages.children?.[1] as CommandNode;

const runGetVisibleItems = (
  state: Parameters<typeof getVisibleItems>[0],
  rootSearchExtras: CommandNode[] = [],
) => {
  const scopeRoot = getScopeRoot(state, tree);

  return getVisibleItems(
    state,
    scopeRoot,
    getSearchCandidates(scopeRoot),
    rootSearchExtras,
  );
};

describe('command palette machine', () => {
  it('sets and clears query when drilling into a container', () => {
    const queriedState = commandPaletteReducer(initialCommandPaletteState, {
      type: 'setQuery',
      query: 'data',
    });
    const drilledState = commandPaletteReducer(queriedState, {
      type: 'drill',
      node: projectPages,
    });

    expect(queriedState.query).toBe('data');
    expect(drilledState).toEqual({ query: '', scopeStack: [projectPages] });
  });

  it('does not drill into leaves', () => {
    expect(
      commandPaletteReducer(initialCommandPaletteState, {
        type: 'drill',
        node: graphql,
      }),
    ).toBe(initialCommandPaletteState);
  });

  it('pops scope and no-ops on an empty scope stack', () => {
    const scopedState = {
      query: '',
      scopeStack: [projectPages, database],
    };

    expect(commandPaletteReducer(scopedState, { type: 'popScope' })).toEqual({
      query: '',
      scopeStack: [projectPages],
    });
    expect(
      commandPaletteReducer(initialCommandPaletteState, { type: 'popScope' }),
    ).toBe(initialCommandPaletteState);
  });

  it('resets to the initial state', () => {
    expect(
      commandPaletteReducer(
        { query: 'graph', scopeStack: [projectPages] },
        { type: 'reset' },
      ),
    ).toEqual(initialCommandPaletteState);
  });

  it('switches from hierarchical listing to flat scored search results', () => {
    expect(
      runGetVisibleItems(initialCommandPaletteState).map(({ node }) => node.id),
    ).toEqual(['project-pages', 'docs']);

    expect(
      runGetVisibleItems({ query: 'database rows', scopeStack: [] }).map(
        ({ node }) => node.id,
      ),
    ).toEqual(['database-browser']);
  });

  it('excludes structural groups without a destination from search', () => {
    expect(
      runGetVisibleItems({ query: 'project pages', scopeStack: [] }),
    ).toEqual([]);
  });

  it('searches root extras at the root scope only', () => {
    const switchNode: CommandNode = {
      id: 'switch:project:acme:app',
      title: 'My App',
      kind: 'project',
      path: '',
      scope: 'project',
    };

    expect(
      runGetVisibleItems({ query: 'my app', scopeStack: [] }, [switchNode]).map(
        ({ node }) => node.id,
      ),
    ).toEqual(['switch:project:acme:app']);

    expect(
      runGetVisibleItems({ query: 'my app', scopeStack: [projectPages] }, [
        switchNode,
      ]),
    ).toEqual([]);
  });

  it('lists scoped direct children while empty and searches within the scope', () => {
    expect(
      runGetVisibleItems({ query: '', scopeStack: [projectPages] }).map(
        ({ node }) => node.id,
      ),
    ).toEqual(['database', 'graphql']);

    expect(
      runGetVisibleItems({ query: 'rows', scopeStack: [projectPages] }).map(
        ({ node }) => node.id,
      ),
    ).toEqual(['database-browser']);
  });
});
