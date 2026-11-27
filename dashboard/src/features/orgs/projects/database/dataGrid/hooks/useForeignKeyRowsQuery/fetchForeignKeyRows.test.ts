import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import {
  fetchForeignKeyRows,
  getPickerLabelColumn,
  prepareForeignKeyRowsSql,
} from './fetchForeignKeyRows';

const options = {
  schema: 'other_schema',
  table: 'members',
  referencedColumns: ['team', 'user'],
  columns: [
    { name: 'team', type: 'bigint' },
    { name: 'user', type: 'uuid' },
    { name: 'name', type: 'text' },
    { name: 'password', type: 'text' },
  ],
  search: '',
};

describe('foreign key search SQL', () => {
  it('requests only mapped keys and one conservative label, without a count', () => {
    const sql = prepareForeignKeyRowsSql(options);
    expect(sql).toContain('FROM other_schema.members');
    expect(sql).toContain('team::text AS key_0, "user"::text AS key_1');
    expect(sql).toContain('left(name::text, 160) AS label');
    expect(sql).toContain('ORDER BY team ASC, "user" ASC LIMIT 21');
    expect(sql).not.toMatch(/password|SELECT \*|COUNT\(/);
  });
  it('does not use arbitrary text or array columns for labels', () => {
    expect(
      getPickerLabelColumn([
        { name: 'password', type: 'text' },
        { name: 'name', type: 'text[]' },
      ]),
    ).toBeUndefined();
    expect(
      getPickerLabelColumn([
        { name: 'email', type: 'text' },
        { name: 'title', type: 'character varying(50)' },
      ]),
    ).toBe('title');
  });
  it('uses type-safe exact numeric matching and OR label search', () => {
    const sql = prepareForeignKeyRowsSql({
      ...options,
      search: '9007199254740993',
    });
    expect(sql).toContain("team = '9007199254740993'::numeric");
    expect(sql).toContain(' OR ');
    expect(sql).not.toContain('::uuid');
  });
  it('does not cast arbitrary search terms to numeric or uuid', () => {
    const sql = prepareForeignKeyRowsSql({ ...options, search: 'Alice' });
    expect(sql).toContain("name::text ILIKE '%Alice%'");
    expect(sql).not.toMatch(/::numeric|::uuid/);
  });
  it('supports UUID key lookup and key-only fallback', () => {
    const uuid = '00000000-0000-0000-0000-000000000001';
    expect(prepareForeignKeyRowsSql({ ...options, search: uuid })).toContain(
      `"user" = '${uuid}'::uuid`,
    );
    const sql = prepareForeignKeyRowsSql({
      ...options,
      columns: options.columns.slice(0, 2),
      search: 'Alice',
    });
    expect(sql).toContain('AND FALSE');
    expect(sql).not.toContain('AS label');
  });
  it('quotes identifiers, escapes literals and preserves internal whitespace', () => {
    const sql = prepareForeignKeyRowsSql({
      ...options,
      schema: 'odd"schema',
      table: 'my table',
      search: "O'Neil  %_",
    });
    expect(sql).toContain('"odd""schema"."my table"');
    expect(sql).toContain("O''Neil  ");
    expect(sql).toContain('\\%');
    expect(sql).toContain('\\_');
  });
  it('serializes array keys as JSON text for the existing form', () => {
    expect(
      prepareForeignKeyRowsSql({
        ...options,
        columns: [{ name: 'ids', type: 'integer[]' }],
        referencedColumns: ['ids'],
      }),
    ).toContain('to_json(ids)::text AS key_0');
  });
});

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const fetchOptions = {
  ...options,
  appUrl: 'https://picker.test',
  adminSecret: 'test-only',
  dataSource: 'default',
};

describe('fetchForeignKeyRows', () => {
  it('caps results and preserves large key strings and blank labels', async () => {
    server.use(
      http.post('https://picker.test/v2/query', async ({ request }) => {
        const body = (await request.json()) as {
          args: { read_only: boolean; source: string };
        };
        expect(body.args).toMatchObject({ read_only: true, source: 'default' });
        return HttpResponse.json({
          result: [
            ['row_to_json'],
            ...Array.from({ length: 21 }, (_, index) => [
              JSON.stringify({
                key_0: '9007199254740993',
                key_1: String(index),
                label: null,
              }),
            ]),
          ],
        });
      }),
    );
    const result = await fetchForeignKeyRows(fetchOptions);
    expect(result.rows).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.rows[0]).toEqual({
      values: ['9007199254740993', '0'],
      label: '',
    });
  });
  it('does not expose raw server errors', async () => {
    server.use(
      http.post('https://picker.test/v2/query', () =>
        HttpResponse.json(
          { error: 'sensitive server details' },
          { status: 403 },
        ),
      ),
    );
    await expect(fetchForeignKeyRows(fetchOptions)).rejects.toThrow(
      'Unable to load linked rows.',
    );
  });
  it('rejects malformed row payloads', async () => {
    server.use(
      http.post('https://picker.test/v2/query', () =>
        HttpResponse.json({ result: [['row_to_json'], ['not json']] }),
      ),
    );
    await expect(fetchForeignKeyRows(fetchOptions)).rejects.toThrow(
      'Unable to load linked rows.',
    );
  });
});
