import {
  alignRelationshipColumnPairs,
  buildRelationshipStructuralKey,
  type LocalRelationshipIdentityInput,
  type RelationshipColumnPair,
  zipRelationshipColumnPairs,
} from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';

const BASE_IDENTITY: LocalRelationshipIdentityInput = {
  type: 'Object',
  source: 'default',
  from: { schema: 'public', table: 'orders' },
  to: { schema: 'public', table: 'customers' },
  columnPairs: [
    { fromColumn: 'customer_id', toColumn: 'id' },
    { fromColumn: 'tenant_id', toColumn: 'tenant_id' },
  ],
};

describe('buildRelationshipStructuralKey', () => {
  it('treats reordered whole pairs as equivalent', () => {
    const reorderedPairs = BASE_IDENTITY.columnPairs.toReversed();

    expect(buildRelationshipStructuralKey(BASE_IDENTITY)).toBe(
      buildRelationshipStructuralKey({
        ...BASE_IDENTITY,
        columnPairs: reorderedPairs,
      }),
    );
  });

  it('keeps crossed pairs distinct', () => {
    expect(buildRelationshipStructuralKey(BASE_IDENTITY)).not.toBe(
      buildRelationshipStructuralKey({
        ...BASE_IDENTITY,
        columnPairs: [
          { fromColumn: 'customer_id', toColumn: 'tenant_id' },
          { fromColumn: 'tenant_id', toColumn: 'id' },
        ],
      }),
    );
  });

  it.each([
    ['type', { type: 'Array' as const }],
    ['source', { source: 'analytics' }],
    [
      'endpoint direction',
      {
        from: BASE_IDENTITY.to,
        to: BASE_IDENTITY.from,
        columnPairs: BASE_IDENTITY.columnPairs.map(
          ({ fromColumn, toColumn }) => ({
            fromColumn: toColumn,
            toColumn: fromColumn,
          }),
        ),
      },
    ],
    ['from schema', { from: { ...BASE_IDENTITY.from, schema: 'private' } }],
    ['from table', { from: { ...BASE_IDENTITY.from, table: 'invoices' } }],
    ['to schema', { to: { ...BASE_IDENTITY.to, schema: 'private' } }],
    ['to table', { to: { ...BASE_IDENTITY.to, table: 'accounts' } }],
  ])('distinguishes identity by %s', (_label, override) => {
    expect(buildRelationshipStructuralKey(BASE_IDENTITY)).not.toBe(
      buildRelationshipStructuralKey({ ...BASE_IDENTITY, ...override }),
    );
  });

  it('does not collide when endpoint or column identifiers contain delimiters', () => {
    const first = buildRelationshipStructuralKey({
      ...BASE_IDENTITY,
      from: { schema: 'public,tenant', table: 'orders|archive' },
      columnPairs: [
        { fromColumn: 'customer→id', toColumn: 'id|legacy' },
        { fromColumn: 'tenant,id', toColumn: 'tenant→id' },
      ],
    });
    const second = buildRelationshipStructuralKey({
      ...BASE_IDENTITY,
      from: { schema: 'public', table: 'tenant,orders|archive' },
      columnPairs: [
        { fromColumn: 'customer', toColumn: 'id→id|legacy' },
        { fromColumn: 'tenant', toColumn: 'id,tenant→id' },
      ],
    });

    expect(first).toBeDefined();
    expect(first).not.toBe(second);
  });

  it('supports repeated target columns in manual mappings', () => {
    expect(
      buildRelationshipStructuralKey({
        ...BASE_IDENTITY,
        allowRepeatedToColumns: true,
        columnPairs: [
          { fromColumn: 'billing_customer_id', toColumn: 'id' },
          { fromColumn: 'shipping_customer_id', toColumn: 'id' },
        ],
      }),
    ).toEqual(expect.any(String));
  });

  it('supports a single column pair', () => {
    expect(
      buildRelationshipStructuralKey({
        ...BASE_IDENTITY,
        columnPairs: [{ fromColumn: 'customer_id', toColumn: 'id' }],
      }),
    ).toEqual(expect.any(String));
  });

  it('does not mutate its input pairs', () => {
    const firstPair = Object.freeze({
      fromColumn: 'tenant_id',
      toColumn: 'tenant_id',
    });
    const secondPair = Object.freeze({
      fromColumn: 'customer_id',
      toColumn: 'id',
    });
    const columnPairs = Object.freeze([firstPair, secondPair]);

    expect(
      buildRelationshipStructuralKey({ ...BASE_IDENTITY, columnPairs }),
    ).toEqual(expect.any(String));
    expect(columnPairs).toEqual([firstPair, secondPair]);
  });

  it.each([
    ['empty source', { source: '' }],
    ['missing endpoint schema', { from: { schema: '', table: 'orders' } }],
    ['missing endpoint table', { to: { schema: 'public', table: '' } }],
    ['no pairs', { columnPairs: [] }],
    [
      'missing from column',
      { columnPairs: [{ fromColumn: '', toColumn: 'id' }] },
    ],
    [
      'missing to column',
      { columnPairs: [{ fromColumn: 'customer_id', toColumn: '' }] },
    ],
    [
      'duplicate from columns',
      {
        columnPairs: [
          { fromColumn: 'tenant_id', toColumn: 'id' },
          { fromColumn: 'tenant_id', toColumn: 'tenant_id' },
        ],
      },
    ],
    [
      'duplicate to columns without manual-mapping semantics',
      {
        columnPairs: [
          { fromColumn: 'customer_id', toColumn: 'id' },
          { fromColumn: 'tenant_id', toColumn: 'id' },
        ],
      },
    ],
  ])('fails closed for %s', (_label, override) => {
    expect(
      buildRelationshipStructuralKey({ ...BASE_IDENTITY, ...override }),
    ).toBeUndefined();
  });
});

describe('zipRelationshipColumnPairs', () => {
  it('zips equal-position columns without mutating the inputs', () => {
    const fromColumns = Object.freeze(['customer_id', 'tenant_id']);
    const toColumns = Object.freeze(['id', 'tenant_id']);

    expect(zipRelationshipColumnPairs(fromColumns, toColumns)).toEqual([
      { fromColumn: 'customer_id', toColumn: 'id' },
      { fromColumn: 'tenant_id', toColumn: 'tenant_id' },
    ]);
    expect(fromColumns).toEqual(['customer_id', 'tenant_id']);
    expect(toColumns).toEqual(['id', 'tenant_id']);
  });

  it.each([
    [['customer_id'], ['id', 'tenant_id']],
    [[], []],
    [[''], ['id']],
    [['customer_id'], ['']],
    [
      ['customer_id', 'customer_id'],
      ['id', 'tenant_id'],
    ],
    [
      ['customer_id', 'tenant_id'],
      ['id', 'id'],
    ],
  ])('fails closed for invalid column arrays', (fromColumns, toColumns) => {
    expect(zipRelationshipColumnPairs(fromColumns, toColumns)).toBeUndefined();
  });

  it('fails closed for non-array runtime values', () => {
    expect(zipRelationshipColumnPairs('customer_id', ['id'])).toBeUndefined();
    expect(zipRelationshipColumnPairs(['customer_id'], null)).toBeUndefined();
  });
});

describe('relationship column pair alignment', () => {
  const PAIRS: readonly RelationshipColumnPair[] = Object.freeze([
    Object.freeze({ fromColumn: 'customer_id', toColumn: 'id' }),
    Object.freeze({ fromColumn: 'tenant_id', toColumn: 'tenant_id' }),
  ]);

  it('aligns cloned whole pairs by requested from-column order', () => {
    const aligned = alignRelationshipColumnPairs(
      PAIRS,
      ['tenant_id', 'customer_id'],
      'fromColumn',
    );

    expect(aligned).toEqual([PAIRS[1], PAIRS[0]]);
    expect(aligned?.[0]).not.toBe(PAIRS[1]);
    expect(PAIRS[0].fromColumn).toBe('customer_id');
  });

  it('aligns cloned whole pairs by requested to-column order', () => {
    expect(
      alignRelationshipColumnPairs(PAIRS, ['tenant_id', 'id'], 'toColumn'),
    ).toEqual([PAIRS[1], PAIRS[0]]);
  });

  it('fails closed when from-column alignment is ambiguous', () => {
    const duplicateFromPairs = [
      { fromColumn: 'tenant_id', toColumn: 'id' },
      { fromColumn: 'tenant_id', toColumn: 'tenant_id' },
    ];

    expect(
      alignRelationshipColumnPairs(
        duplicateFromPairs,
        ['tenant_id', 'tenant_id'],
        'fromColumn',
      ),
    ).toBeUndefined();
  });

  it('fails closed when to-column alignment is ambiguous', () => {
    const duplicateToPairs = [
      { fromColumn: 'customer_id', toColumn: 'id' },
      { fromColumn: 'tenant_id', toColumn: 'id' },
    ];

    expect(
      alignRelationshipColumnPairs(duplicateToPairs, ['id', 'id'], 'toColumn'),
    ).toBeUndefined();
  });

  it.each([
    [['id']],
    [['id', 'missing']],
    [['id', '']],
  ])('fails closed for invalid requested alignment', (requestedColumns) => {
    expect(
      alignRelationshipColumnPairs(PAIRS, requestedColumns, 'toColumn'),
    ).toBeUndefined();
  });
});
