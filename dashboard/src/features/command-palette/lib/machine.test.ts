import {
  commandPaletteReducer,
  drill,
  getVisibleItems,
  initialCommandPaletteState,
  popScope,
  reset,
  setQuery,
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

describe('command palette machine', () => {
  it('sets and clears query when drilling into a container', () => {
    const queriedState = commandPaletteReducer(
      initialCommandPaletteState,
      setQuery('data'),
    );
    const drilledState = commandPaletteReducer(
      queriedState,
      drill(projectPages),
    );

    expect(queriedState.query).toBe('data');
    expect(drilledState).toEqual({ query: '', scopeStack: [projectPages] });
  });

  it('does not drill into leaves', () => {
    expect(
      commandPaletteReducer(initialCommandPaletteState, drill(graphql)),
    ).toBe(initialCommandPaletteState);
  });

  it('pops scope and no-ops on an empty scope stack', () => {
    const scopedState = {
      query: '',
      scopeStack: [projectPages, database],
    };

    expect(commandPaletteReducer(scopedState, popScope())).toEqual({
      query: '',
      scopeStack: [projectPages],
    });
    expect(commandPaletteReducer(initialCommandPaletteState, popScope())).toBe(
      initialCommandPaletteState,
    );
  });

  it('resets to the initial state', () => {
    expect(
      commandPaletteReducer(
        { query: 'graph', scopeStack: [projectPages] },
        reset(),
      ),
    ).toEqual(initialCommandPaletteState);
  });

  it('switches from hierarchical listing to flat scored search results', () => {
    expect(
      getVisibleItems(initialCommandPaletteState, tree).map(
        ({ node }) => node.id,
      ),
    ).toEqual(['project-pages', 'docs']);

    expect(
      getVisibleItems({ query: 'database rows', scopeStack: [] }, tree).map(
        ({ node }) => node.id,
      ),
    ).toEqual(['database-browser']);
  });

  it('lists scoped direct children while empty and searches within the scope', () => {
    expect(
      getVisibleItems({ query: '', scopeStack: [projectPages] }, tree).map(
        ({ node }) => node.id,
      ),
    ).toEqual(['database', 'graphql']);

    expect(
      getVisibleItems({ query: 'rows', scopeStack: [projectPages] }, tree).map(
        ({ node }) => node.id,
      ),
    ).toEqual(['database-browser']);
  });
});
