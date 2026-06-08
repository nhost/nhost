import { describe, expect, it } from 'vitest';
import buildForeignKeyRelations, {
  type ForeignKeyConstraintColumn,
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
    const columns: ForeignKeyConstraintColumn[] = [
      { column_name: 'author_id' },
    ];

    const result = buildForeignKeyRelations(constraints, columns, 'public');

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
    const columns: ForeignKeyConstraintColumn[] = [
      { column_name: 'a' },
      { column_name: 'b' },
    ];

    let result: ReturnType<typeof buildForeignKeyRelations>;
    expect(() => {
      result = buildForeignKeyRelations(constraints, columns, 'public');
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
    const columns: ForeignKeyConstraintColumn[] = [
      { column_name: 'a' },
      { column_name: 'b' },
    ];

    const result = buildForeignKeyRelations(constraints, columns, 'public');

    expect(result.foreignKeyRelations).toHaveLength(1);
    expect(result.foreignKeyRelations[0].oneToOne).toBe(true);
    expect(result.primaryConstraintsByColumn.get('a')).toEqual(['child_pkey']);
    expect(result.primaryConstraintsByColumn.get('b')).toEqual(['child_pkey']);
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
    const columns: ForeignKeyConstraintColumn[] = [
      { column_name: 'a' },
      { column_name: 'b' },
    ];

    const result = buildForeignKeyRelations(constraints, columns, 'public');

    expect(result.foreignKeyRelations).toHaveLength(1);
    expect(result.foreignKeyRelations[0].oneToOne).toBe(false);
    expect(result.uniqueConstraintsByColumn.get('a')).toEqual(['child_a_key']);
  });

  it('should mark a single-column foreign key one-to-one when its column is primary or unique', () => {
    const constraints: RawTableConstraint[] = [
      {
        constraint_name: 'child_author_id_fkey',
        constraint_type: 'f',
        constraint_definition:
          'FOREIGN KEY (author_id) REFERENCES public.authors(id) ON UPDATE NO ACTION ON DELETE NO ACTION',
        column_name: 'author_id',
      },
    ];

    const primaryColumns: ForeignKeyConstraintColumn[] = [
      { column_name: 'author_id', is_primary: true },
    ];
    const primaryResult = buildForeignKeyRelations(
      constraints,
      primaryColumns,
      'public',
    );
    expect(primaryResult.foreignKeyRelations[0].oneToOne).toBe(true);

    const uniqueColumns: ForeignKeyConstraintColumn[] = [
      { column_name: 'author_id', is_unique: true },
    ];
    const uniqueResult = buildForeignKeyRelations(
      constraints,
      uniqueColumns,
      'public',
    );
    expect(uniqueResult.foreignKeyRelations[0].oneToOne).toBe(true);

    const plainColumns: ForeignKeyConstraintColumn[] = [
      { column_name: 'author_id' },
    ];
    const plainResult = buildForeignKeyRelations(
      constraints,
      plainColumns,
      'public',
    );
    expect(plainResult.foreignKeyRelations[0].oneToOne).toBe(false);
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
    const columns: ForeignKeyConstraintColumn[] = [
      { column_name: 'author_id' },
    ];

    const result = buildForeignKeyRelations(constraints, columns, 'custom');

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
    const columns: ForeignKeyConstraintColumn[] = [
      { column_name: 'id' },
      { column_name: 'email' },
    ];

    const result = buildForeignKeyRelations(constraints, columns, 'public');

    expect(result.foreignKeyRelations).toHaveLength(0);
    expect(result.primaryConstraintsByColumn.get('id')).toEqual(['child_pkey']);
    expect(result.uniqueConstraintsByColumn.get('email')).toEqual([
      'child_email_key',
      'child_email_org_key',
    ]);
  });
});
