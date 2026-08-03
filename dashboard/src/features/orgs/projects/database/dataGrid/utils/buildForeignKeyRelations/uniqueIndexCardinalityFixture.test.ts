import {
  buildForeignKeyRelations,
  type RawTableConstraint,
} from '@/features/orgs/projects/database/dataGrid/utils/buildForeignKeyRelations';

const UNIQUE_INDEX_QUERY_ROWS: RawTableConstraint[] = [
  {
    constraint_name: 'child_a_b_fkey',
    constraint_type: 'f',
    constraint_definition: 'FOREIGN KEY (a, b) REFERENCES smoke.parent(x, y)',
    column_name: 'a',
  },
  {
    constraint_name: 'child_a_b_fkey',
    constraint_type: 'f',
    constraint_definition: 'FOREIGN KEY (a, b) REFERENCES smoke.parent(x, y)',
    column_name: 'b',
  },
  {
    constraint_name: 'child_a_fkey',
    constraint_type: 'f',
    constraint_definition: 'FOREIGN KEY (a) REFERENCES smoke.parent(id)',
    column_name: 'a',
  },
  {
    constraint_name: 'child_single_fkey',
    constraint_type: 'f',
    constraint_definition:
      'FOREIGN KEY (single_id) REFERENCES smoke.parent(id)',
    column_name: 'single_id',
  },
  {
    constraint_name: 'child_a_b_idx',
    constraint_type: 'i',
    constraint_definition: null,
    column_name: 'a',
  },
  {
    constraint_name: 'child_a_b_idx',
    constraint_type: 'i',
    constraint_definition: null,
    column_name: 'b',
  },
  {
    constraint_name: 'child_single_idx',
    constraint_type: 'i',
    constraint_definition: null,
    column_name: 'single_id',
  },
];

describe('unique-index cardinality query-row fixture', () => {
  it('preserves exact and subset cardinality from production query rows', () => {
    const relations = buildForeignKeyRelations(
      UNIQUE_INDEX_QUERY_ROWS,
      'smoke',
    ).foreignKeyRelations;
    const cardinality = Object.fromEntries(
      relations.map(({ name, oneToOne }) => [name, oneToOne]),
    );

    expect(cardinality).toMatchObject({
      child_single_fkey: true,
      child_a_b_fkey: true,
      child_a_fkey: false,
    });
  });
});
