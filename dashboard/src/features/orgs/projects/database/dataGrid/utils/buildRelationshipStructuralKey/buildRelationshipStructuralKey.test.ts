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
  it('treats reordered whole pairs as equivalent but keeps crossed pairs distinct', () => {
    const reorderedPairs = BASE_IDENTITY.columnPairs.toReversed();

    expect(buildRelationshipStructuralKey(BASE_IDENTITY)).toBe(
      buildRelationshipStructuralKey({
        ...BASE_IDENTITY,
        columnPairs: reorderedPairs,
      }),
    );
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
  ])('distinguishes identity by %s', (_label, override) => {
    expect(buildRelationshipStructuralKey(BASE_IDENTITY)).not.toBe(
      buildRelationshipStructuralKey({ ...BASE_IDENTITY, ...override }),
    );
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

  it.each([
    ['no pairs', { columnPairs: [] }],
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
    [
      ['customer_id', 'customer_id'],
      ['id', 'tenant_id'],
    ],
  ])('fails closed for invalid column arrays', (fromColumns, toColumns) => {
    expect(zipRelationshipColumnPairs(fromColumns, toColumns)).toBeUndefined();
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

  it.each([[['id']], [['id', 'missing']]])('fails closed for invalid requested alignment', (requestedColumns) => {
    expect(
      alignRelationshipColumnPairs(PAIRS, requestedColumns, 'toColumn'),
    ).toBeUndefined();
  });
});
