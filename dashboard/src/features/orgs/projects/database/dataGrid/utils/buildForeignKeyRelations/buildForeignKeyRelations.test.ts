import { describe, expect, it } from 'vitest';
import buildForeignKeyRelations, {
  type RawTableConstraint,
} from './buildForeignKeyRelations';

const COMPOSITE_DEFINITION =
  'FOREIGN KEY (a, b) REFERENCES public.parent(x, y) ON UPDATE NO ACTION ON DELETE NO ACTION';

describe('buildForeignKeyRelations', () => {
  it('should parse a single-column foreign key into one relation keyed by its column', () => {
    const constraints: RawTableConstraint[] = [
      {
        constraint_name: 'child_author_id_fkey',
        constraint_type: 'f',
        constraint_definition:
          'FOREIGN KEY (author_id) REFERENCES public.authors(id) ON UPDATE RESTRICT ON DELETE CASCADE',
        column_name: 'author_id',
      },
    ];

    const result = buildForeignKeyRelations(constraints, 'public');

    expect(result.foreignKeyRelations).toHaveLength(1);
    expect(result.foreignKeyRelations[0]).toMatchObject({
      name: 'child_author_id_fkey',
      columns: ['author_id'],
      referencedSchema: 'public',
      referencedTable: 'authors',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
      oneToOne: false,
    });
    expect(result.foreignKeyRelationsByColumn.get('author_id')).toBe(
      result.foreignKeyRelations[0],
    );
  });

  it('should not throw and should dedupe a composite foreign key arriving as two rows', () => {
    const constraints: RawTableConstraint[] = [
      {
        constraint_name: 'child_a_b_fkey',
        constraint_type: 'f',
        constraint_definition: COMPOSITE_DEFINITION,
        column_name: 'a',
      },
      {
        constraint_name: 'child_a_b_fkey',
        constraint_type: 'f',
        constraint_definition: COMPOSITE_DEFINITION,
        column_name: 'b',
      },
    ];

    let result: ReturnType<typeof buildForeignKeyRelations>;
    expect(() => {
      result = buildForeignKeyRelations(constraints, 'public');
    }).not.toThrow();

    expect(result!.foreignKeyRelations).toHaveLength(1);
    expect(result!.foreignKeyRelations[0]).toMatchObject({
      name: 'child_a_b_fkey',
      columns: ['a', 'b'],
      referencedSchema: 'public',
      referencedTable: 'parent',
      referencedColumns: ['x', 'y'],
      oneToOne: false,
    });

    const relation = result!.foreignKeyRelations[0];
    expect(result!.foreignKeyRelationsByColumn.get('a')).toBe(relation);
    expect(result!.foreignKeyRelationsByColumn.get('b')).toBe(relation);
  });

  it('should mark a composite foreign key one-to-one when its columns are covered by a primary key', () => {
    const constraints: RawTableConstraint[] = [
      {
        constraint_name: 'child_a_b_fkey',
        constraint_type: 'f',
        constraint_definition: COMPOSITE_DEFINITION,
        column_name: 'a',
      },
      {
        constraint_name: 'child_a_b_fkey',
        constraint_type: 'f',
        constraint_definition: COMPOSITE_DEFINITION,
        column_name: 'b',
      },
      {
        constraint_name: 'child_pkey',
        constraint_type: 'p',
        column_name: 'a',
      },
      {
        constraint_name: 'child_pkey',
        constraint_type: 'p',
        column_name: 'b',
      },
    ];

    const result = buildForeignKeyRelations(constraints, 'public');

    expect(result.foreignKeyRelations).toHaveLength(1);
    expect(result.foreignKeyRelations[0].oneToOne).toBe(true);
    expect(result.primaryConstraintsByColumn.get('a')).toEqual(['child_pkey']);
    expect(result.primaryConstraintsByColumn.get('b')).toEqual(['child_pkey']);
    expect(result.constraintColumnSets).toEqual([['a', 'b']]);
  });

  it('should not mark a composite foreign key one-to-one when no unique/primary set covers its columns', () => {
    const constraints: RawTableConstraint[] = [
      {
        constraint_name: 'child_a_b_fkey',
        constraint_type: 'f',
        constraint_definition: COMPOSITE_DEFINITION,
        column_name: 'a',
      },
      {
        constraint_name: 'child_a_b_fkey',
        constraint_type: 'f',
        constraint_definition: COMPOSITE_DEFINITION,
        column_name: 'b',
      },
      {
        constraint_name: 'child_a_key',
        constraint_type: 'u',
        column_name: 'a',
      },
    ];

    const result = buildForeignKeyRelations(constraints, 'public');

    expect(result.foreignKeyRelations).toHaveLength(1);
    expect(result.foreignKeyRelations[0].oneToOne).toBe(false);
    expect(result.uniqueConstraintsByColumn.get('a')).toEqual(['child_a_key']);
  });

  it('should mark a single-column foreign key one-to-one when its column is primary or uniquely constrained', () => {
    const constraints: RawTableConstraint[] = [
      {
        constraint_name: 'child_author_id_fkey',
        constraint_type: 'f',
        constraint_definition:
          'FOREIGN KEY (author_id) REFERENCES public.authors(id) ON UPDATE NO ACTION ON DELETE NO ACTION',
        column_name: 'author_id',
      },
    ];

    const primaryResult = buildForeignKeyRelations(
      [
        ...constraints,
        {
          constraint_name: 'child_pkey',
          constraint_type: 'p',
          column_name: 'author_id',
        },
      ],
      'public',
    );
    expect(primaryResult.foreignKeyRelations[0].oneToOne).toBe(true);

    const uniqueResult = buildForeignKeyRelations(
      [
        ...constraints,
        {
          constraint_name: 'child_author_id_key',
          constraint_type: 'u',
          column_name: 'author_id',
        },
      ],
      'public',
    );
    expect(uniqueResult.foreignKeyRelations[0].oneToOne).toBe(true);

    const plainResult = buildForeignKeyRelations(constraints, 'public');
    expect(plainResult.foreignKeyRelations[0].oneToOne).toBe(false);
  });

  it('should not mark a single-column foreign key one-to-one when its column is part of a composite primary key', () => {
    const constraints: RawTableConstraint[] = [
      {
        constraint_name: 'memberships_user_id_fkey',
        constraint_type: 'f',
        constraint_definition:
          'FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE NO ACTION',
        column_name: 'user_id',
      },
      {
        constraint_name: 'memberships_pkey',
        constraint_type: 'p',
        column_name: 'user_id',
      },
      {
        constraint_name: 'memberships_pkey',
        constraint_type: 'p',
        column_name: 'team_id',
      },
    ];

    const result = buildForeignKeyRelations(constraints, 'public');

    expect(result.foreignKeyRelations).toHaveLength(1);
    expect(result.foreignKeyRelations[0].oneToOne).toBe(false);
  });

  it('should not mark a single-column foreign key one-to-one when its column is only part of a composite unique constraint', () => {
    const constraints: RawTableConstraint[] = [
      {
        constraint_name: 'child_a_fkey',
        constraint_type: 'f',
        constraint_definition:
          'FOREIGN KEY (a) REFERENCES public.parent(x) ON UPDATE NO ACTION ON DELETE NO ACTION',
        column_name: 'a',
      },
      {
        constraint_name: 'child_a_b_key',
        constraint_type: 'u',
        column_name: 'a',
      },
      {
        constraint_name: 'child_a_b_key',
        constraint_type: 'u',
        column_name: 'b',
      },
    ];

    const result = buildForeignKeyRelations(constraints, 'public');

    expect(result.foreignKeyRelations).toHaveLength(1);
    expect(result.foreignKeyRelations[0].oneToOne).toBe(false);
  });

  it('should fall back to the table schema when the referenced schema is omitted', () => {
    const constraints: RawTableConstraint[] = [
      {
        constraint_name: 'child_author_id_fkey',
        constraint_type: 'f',
        constraint_definition:
          'FOREIGN KEY (author_id) REFERENCES authors(id) ON UPDATE NO ACTION ON DELETE NO ACTION',
        column_name: 'author_id',
      },
    ];

    const result = buildForeignKeyRelations(constraints, 'custom');

    expect(result.foreignKeyRelations[0].referencedSchema).toBe('custom');
  });

  it('should populate unique and primary constraint maps per column', () => {
    const constraints: RawTableConstraint[] = [
      {
        constraint_name: 'child_pkey',
        constraint_type: 'p',
        column_name: 'id',
      },
      {
        constraint_name: 'child_email_key',
        constraint_type: 'u',
        column_name: 'email',
      },
      {
        constraint_name: 'child_email_org_key',
        constraint_type: 'u',
        column_name: 'email',
      },
    ];

    const result = buildForeignKeyRelations(constraints, 'public');

    expect(result.foreignKeyRelations).toHaveLength(0);
    expect(result.primaryConstraintsByColumn.get('id')).toEqual(['child_pkey']);
    expect(result.uniqueConstraintsByColumn.get('email')).toEqual([
      'child_email_key',
      'child_email_org_key',
    ]);
    expect(result.constraintColumnSets).toEqual([['id'], ['email']]);
  });

  it('uses an exact standalone unique-index set for single-column cardinality without populating constraint maps', () => {
    const result = buildForeignKeyRelations(
      [
        {
          constraint_name: 'child_author_id_fkey',
          constraint_type: 'f',
          constraint_definition:
            'FOREIGN KEY (author_id) REFERENCES public.authors(id)',
          column_name: 'author_id',
        },
        {
          constraint_name: 'child_author_id_idx',
          constraint_type: 'i',
          constraint_definition: null,
          column_name: 'author_id',
        },
      ],
      'public',
    );

    expect(result.foreignKeyRelations[0].oneToOne).toBe(true);
    expect(result.constraintColumnSets).toEqual([['author_id']]);
    expect(result.primaryConstraintsByColumn.size).toBe(0);
    expect(result.uniqueConstraintsByColumn.size).toBe(0);
  });

  it('accepts an exact composite unique-index set but rejects a strict subset', () => {
    const indexRows: RawTableConstraint[] = [
      {
        constraint_name: 'child_a_b_idx',
        constraint_type: 'i',
        column_name: 'a',
      },
      {
        constraint_name: 'child_a_b_idx',
        constraint_type: 'i',
        column_name: 'b',
      },
    ];

    const exact = buildForeignKeyRelations(
      [
        {
          constraint_name: 'child_a_b_fkey',
          constraint_type: 'f',
          constraint_definition: COMPOSITE_DEFINITION,
          column_name: 'a',
        },
        {
          constraint_name: 'child_a_b_fkey',
          constraint_type: 'f',
          constraint_definition: COMPOSITE_DEFINITION,
          column_name: 'b',
        },
        ...indexRows,
      ],
      'public',
    );
    const subset = buildForeignKeyRelations(
      [
        {
          constraint_name: 'child_a_fkey',
          constraint_type: 'f',
          constraint_definition: 'FOREIGN KEY (a) REFERENCES public.parent(x)',
          column_name: 'a',
        },
        ...indexRows,
      ],
      'public',
    );

    expect(exact.foreignKeyRelations[0].oneToOne).toBe(true);
    expect(subset.foreignKeyRelations[0].oneToOne).toBe(false);
  });

  it('deduplicates reordered and constraint/index-shaped equivalent sets', () => {
    const result = buildForeignKeyRelations(
      [
        {
          constraint_name: 'first_idx',
          constraint_type: 'i',
          column_name: 'a',
        },
        {
          constraint_name: 'first_idx',
          constraint_type: 'i',
          column_name: 'b',
        },
        {
          constraint_name: 'second_idx',
          constraint_type: 'i',
          column_name: 'b',
        },
        {
          constraint_name: 'second_idx',
          constraint_type: 'i',
          column_name: 'a',
        },
        {
          constraint_name: 'child_a_b_key',
          constraint_type: 'u',
          column_name: 'a',
        },
        {
          constraint_name: 'child_a_b_key',
          constraint_type: 'u',
          column_name: 'b',
        },
      ],
      'public',
    );

    expect(result.constraintColumnSets).toEqual([['a', 'b']]);
    expect(result.uniqueConstraintsByColumn.get('a')).toEqual([
      'child_a_b_key',
    ]);
    expect(result.uniqueConstraintsByColumn.get('b')).toEqual([
      'child_a_b_key',
    ]);
  });

  it('classifies candidates, preserves ordinality, and keeps same-set names distinct', () => {
    const result = buildForeignKeyRelations(
      [
        {
          constraint_name: 'table_pkey',
          constraint_type: 'p',
          column_name: 'id',
          column_ordinality: 1,
        },
        {
          constraint_name: 'first_key',
          constraint_type: 'u',
          column_name: 'b',
          column_ordinality: 2,
        },
        {
          constraint_name: 'first_key',
          constraint_type: 'u',
          column_name: 'a',
          column_ordinality: 1,
        },
        {
          constraint_name: 'second_key',
          constraint_type: 'u',
          column_name: 'a',
          column_ordinality: 1,
        },
        {
          constraint_name: 'second_key',
          constraint_type: 'u',
          column_name: 'b',
          column_ordinality: 2,
        },
        {
          constraint_name: 'legacy_idx',
          constraint_type: 'i',
          column_name: 'a',
          column_ordinality: 1,
        },
      ],
      'public',
    );

    expect(result.candidateKeys).toEqual([
      {
        id: 'primaryKey:table_pkey',
        name: 'table_pkey',
        kind: 'primaryKey',
        columns: ['id'],
      },
      {
        id: 'uniqueConstraint:first_key',
        name: 'first_key',
        kind: 'uniqueConstraint',
        columns: ['a', 'b'],
      },
      {
        id: 'uniqueConstraint:second_key',
        name: 'second_key',
        kind: 'uniqueConstraint',
        columns: ['a', 'b'],
      },
      {
        id: 'standaloneUniqueIndex:legacy_idx',
        name: 'legacy_idx',
        kind: 'standaloneUniqueIndex',
        columns: ['a'],
      },
    ]);
    expect(result.uniqueConstraints).toEqual([
      {
        id: 'uniqueConstraint:first_key',
        originalName: 'first_key',
        name: 'first_key',
        columns: ['a', 'b'],
      },
      {
        id: 'uniqueConstraint:second_key',
        originalName: 'second_key',
        name: 'second_key',
        columns: ['a', 'b'],
      },
    ]);
    expect(result.constraintColumnSets).toEqual([['id'], ['a', 'b'], ['a']]);
  });

  it('keeps same-name constraint and index groups separate', () => {
    const result = buildForeignKeyRelations(
      [
        {
          constraint_name: 'shared_name',
          constraint_type: 'u',
          column_name: 'a',
        },
        {
          constraint_name: 'shared_name',
          constraint_type: 'i',
          column_name: 'b',
        },
      ],
      'public',
    );

    expect(result.constraintColumnSets).toEqual([['a'], ['b']]);
    expect(result.uniqueConstraintsByColumn.get('a')).toEqual(['shared_name']);
    expect(result.uniqueConstraintsByColumn.has('b')).toBe(false);
  });
});
