import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { createDataGridColumn } from './DataBrowserGrid';

function makeColumn(
  overrides: Partial<NormalizedQueryDataRow> = {},
): NormalizedQueryDataRow {
  return {
    column_name: 'col',
    data_type: 'text',
    udt_name: 'text',
    full_data_type: 'text',
    is_primary: false,
    is_nullable: 'YES',
    column_default: null,
    ...overrides,
  };
}

describe('createDataGridColumn — enableSorting', () => {
  it.each([
    ['point'],
    ['line'],
    ['lseg'],
    ['box'],
    ['path'],
    ['polygon'],
    ['circle'],
    ['json'],
    ['xml'],
  ])('disables sorting for unsortable type %s', (type) => {
    const column = createDataGridColumn(
      makeColumn({ data_type: type, udt_name: type }),
    );
    expect(column.enableSorting).toBe(false);
  });

  it.each([
    ['text', 'text'],
    ['integer', 'int4'],
    ['boolean', 'bool'],
    ['uuid', 'uuid'],
    ['jsonb', 'jsonb'],
    ['timestamp with time zone', 'timestamptz'],
  ])('keeps sorting enabled for sortable type %s', (dataType, udtName) => {
    const column = createDataGridColumn(
      makeColumn({ data_type: dataType, udt_name: udtName }),
    );
    expect(column.enableSorting).toBe(true);
  });
});
