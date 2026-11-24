import {
  createPlaygroundStorage,
  removeSharedPlaygroundStorage,
} from './playgroundStorage';

const historyEntry = {
  query: '{ users { id } }',
  variables: '{"limit":3}',
  headers: '{"Authorization":"Bearer secret-token"}',
  operationName: undefined,
};

describe('createPlaygroundStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps each project apart', () => {
    const projectA = createPlaygroundStorage('project-a');
    const projectB = createPlaygroundStorage('project-b');

    projectA.setItem('graphiql:tabState', 'tabs of a');

    expect(projectA.getItem('graphiql:tabState')).toBe('tabs of a');
    expect(projectB.getItem('graphiql:tabState')).toBeNull();
    expect(window.localStorage.getItem('graphiql:tabState')).toBeNull();
  });

  it('saves history and starred queries without headers', () => {
    const storage = createPlaygroundStorage('project-a');

    storage.setItem(
      'graphiql:queries',
      JSON.stringify({ queries: [historyEntry] }),
    );
    storage.setItem(
      'graphiql:favorites',
      JSON.stringify({ favorites: [{ ...historyEntry, favorite: true }] }),
    );

    const queries = storage.getItem('graphiql:queries') ?? '';
    const favorites = storage.getItem('graphiql:favorites') ?? '';

    expect(queries).not.toContain('secret-token');
    expect(favorites).not.toContain('secret-token');
    expect(JSON.parse(queries).queries[0]).toEqual({
      query: historyEntry.query,
      variables: historyEntry.variables,
    });
  });

  it('saves a query run several times once', () => {
    const storage = createPlaygroundStorage('project-a');
    const other = { query: '{ files { id } }', variables: '' };

    storage.setItem(
      'graphiql:queries',
      JSON.stringify({ queries: [historyEntry, other, historyEntry] }),
    );

    const { queries } = JSON.parse(storage.getItem('graphiql:queries') ?? '');

    expect(queries).toHaveLength(2);
    expect(queries[1].query).toBe(historyEntry.query);
  });

  it('never stores the headers editor', () => {
    const storage = createPlaygroundStorage('project-a');

    storage.setItem('graphiql:headers', historyEntry.headers);

    expect(storage.getItem('graphiql:headers')).toBeNull();
  });

  it('clears only its own project', () => {
    const projectA = createPlaygroundStorage('project-a');
    const projectB = createPlaygroundStorage('project-b');

    projectA.setItem('graphiql:query', 'a');
    projectB.setItem('graphiql:query', 'b');
    projectA.clear();

    expect(projectA.length).toBe(0);
    expect(projectB.getItem('graphiql:query')).toBe('b');
  });
});

describe('removeSharedPlaygroundStorage', () => {
  it('removes the old shared keys and keeps per project ones', () => {
    window.localStorage.clear();
    window.localStorage.setItem('graphiql:headers', historyEntry.headers);
    window.localStorage.setItem('graphiql:tabState', '{}');
    createPlaygroundStorage('project-a').setItem('graphiql:query', 'a');

    removeSharedPlaygroundStorage();

    expect(window.localStorage.getItem('graphiql:headers')).toBeNull();
    expect(window.localStorage.getItem('graphiql:tabState')).toBeNull();
    expect(window.localStorage.getItem('graphiql:project-a:query')).toBe('a');
  });
});
