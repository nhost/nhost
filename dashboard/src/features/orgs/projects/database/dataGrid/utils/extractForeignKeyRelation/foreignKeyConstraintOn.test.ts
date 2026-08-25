import {
  parseForeignKeyConstraintOn,
  parseManualRelationshipConfiguration,
  serializeForeignKeyConstraintOn,
} from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';

describe('relationship metadata normalization', () => {
  it.each([
    ['legacy scalar', 'tenant,id', { columns: ['tenant,id'] }],
    [
      'legacy scalar object',
      { column: 'tenant|id' },
      { columns: ['tenant|id'] },
    ],
    [
      'local array',
      ['tenant_id', 'parent_id'],
      { columns: ['tenant_id', 'parent_id'] },
    ],
    [
      'local columns object',
      { columns: ['tenant_id', 'parent_id'] },
      { columns: ['tenant_id', 'parent_id'] },
    ],
    [
      'qualified scalar object',
      {
        column: 'parent_id',
        table: { schema: 'private', name: 'children' },
      },
      {
        columns: ['parent_id'],
        table: { schema: 'private', name: 'children' },
      },
    ],
    [
      'qualified columns object',
      {
        columns: ['tenant_id', 'parent_id'],
        table: { schema: 'private', name: 'children' },
      },
      {
        columns: ['tenant_id', 'parent_id'],
        table: { schema: 'private', name: 'children' },
      },
    ],
  ])('normalizes the %s shape', (_label, input, expected) => {
    expect(parseForeignKeyConstraintOn(input)).toEqual(expected);
  });

  it.each([
    null,
    '',
    [],
    ['tenant_id', 'tenant_id'],
    ['tenant_id', ''],
    ['tenant_id', 42],
    { column: 'tenant_id', columns: ['tenant_id'] },
    { column: '' },
    { columns: [] },
    { columns: ['tenant_id', 'tenant_id'] },
    { columns: ['tenant_id'], table: {} },
    { columns: ['tenant_id'], table: { schema: '', name: 'children' } },
    { table: { schema: 'public', name: 'children' } },
  ])('rejects malformed foreign-key metadata %#', (input) => {
    expect(parseForeignKeyConstraintOn(input)).toBeUndefined();
  });

  it('serializes scalar and composite local and qualified forms', () => {
    const table = { schema: 'public', name: 'children' };

    expect(serializeForeignKeyConstraintOn(['tenant_id'])).toBe('tenant_id');
    expect(serializeForeignKeyConstraintOn(['tenant_id', 'parent_id'])).toEqual(
      ['tenant_id', 'parent_id'],
    );
    expect(serializeForeignKeyConstraintOn(['tenant_id'], table)).toEqual({
      column: 'tenant_id',
      table,
    });
    expect(
      serializeForeignKeyConstraintOn(['tenant_id', 'parent_id'], table),
    ).toEqual({ columns: ['tenant_id', 'parent_id'], table });
  });

  it('does not serialize empty, duplicate, or partially qualified values', () => {
    expect(serializeForeignKeyConstraintOn([])).toBeUndefined();
    expect(
      serializeForeignKeyConstraintOn(['tenant_id', 'tenant_id']),
    ).toBeUndefined();
    expect(
      serializeForeignKeyConstraintOn(['tenant_id'], {
        schema: '',
        name: 'children',
      }),
    ).toBeUndefined();
  });

  it('normalizes complete manual mappings without changing identifier text', () => {
    expect(
      parseManualRelationshipConfiguration({
        remote_table: { schema: 'tenant,schema', name: 'parent|table' },
        column_mapping: {
          'local→one': 'remote,one',
          'local|two': 'remote→two',
        },
      }),
    ).toEqual({
      table: { schema: 'tenant,schema', name: 'parent|table' },
      columnPairs: [
        { fromColumn: 'local→one', toColumn: 'remote,one' },
        { fromColumn: 'local|two', toColumn: 'remote→two' },
      ],
    });
  });

  it('preserves repeated target columns and mapping entry order', () => {
    expect(
      parseManualRelationshipConfiguration({
        remote_table: { schema: 'public', name: 'parent' },
        column_mapping: { first_id: 'id', second_id: 'id' },
      }),
    ).toEqual({
      table: { schema: 'public', name: 'parent' },
      columnPairs: [
        { fromColumn: 'first_id', toColumn: 'id' },
        { fromColumn: 'second_id', toColumn: 'id' },
      ],
    });
  });

  it.each([
    null,
    {},
    { remote_table: { schema: 'public', name: 'parent' }, column_mapping: {} },
    {
      remote_table: { schema: 'public', name: 'parent' },
      column_mapping: { '': 'remote_id' },
    },
    {
      remote_table: { schema: '', name: 'parent' },
      column_mapping: { parent_id: 'id' },
    },
    {
      remote_table: { schema: 'public', name: 'parent' },
      column_mapping: { parent_id: '' },
    },
    {
      remote_table: { schema: 'public', name: 'parent' },
      column_mapping: { parent_id: 42 },
    },
  ])('rejects malformed manual relationship metadata %#', (input) => {
    expect(parseManualRelationshipConfiguration(input)).toBeUndefined();
  });
});
