import { HttpResponse, http } from 'msw';
import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { screen, TestUserEvent } from '@/tests/testUtils';

export const HASURA_QUERY_URL = 'https://local.hasura.local.nhost.run/v2/query';

function databaseResult() {
  return {
    result_type: 'TuplesOk',
    result: [['data'], [JSON.stringify({ schema_name: 'public' })]],
  };
}

function tableLikeObjectsResult() {
  return {
    result_type: 'TuplesOk',
    result: [
      ['data'],
      [
        JSON.stringify({
          table_schema: 'public',
          table_name: 'authors',
          table_type: 'ORDINARY TABLE',
          updatability: 1,
        }),
      ],
    ],
  };
}

function functionsResult() {
  return { result_type: 'TuplesOk', result: [['data']] };
}

function authorsColumnsResult() {
  return {
    result_type: 'TuplesOk',
    result: [
      ['row_to_json'],
      [
        JSON.stringify({
          table_schema: 'public',
          table_name: 'authors',
          column_name: 'id',
          ordinal_position: 1,
          data_type: 'uuid',
          udt_name: 'uuid',
          is_primary: true,
          is_unique: true,
        }),
      ],
      [
        JSON.stringify({
          table_schema: 'public',
          table_name: 'authors',
          column_name: 'uuid',
          ordinal_position: 2,
          data_type: 'uuid',
          udt_name: 'uuid',
          is_primary: false,
          is_unique: false,
        }),
      ],
    ],
  };
}

function authorsConstraintsResult() {
  return {
    result_type: 'TuplesOk',
    result: [
      ['row_to_json'],
      [
        JSON.stringify({
          constraint_name: 'authors_pkey',
          constraint_type: 'p',
          column_name: 'id',
          column_ordinality: 1,
          is_referenceable: true,
          referenced_schema: null,
          referenced_table: null,
          referenced_column_name: null,
          update_action_code: null,
          delete_action_code: null,
        }),
      ],
      [
        JSON.stringify({
          constraint_name: 'authors_id_uuid_key',
          constraint_type: 'u',
          column_name: 'id',
          column_ordinality: 1,
          is_referenceable: true,
          referenced_schema: null,
          referenced_table: null,
          referenced_column_name: null,
          update_action_code: null,
          delete_action_code: null,
        }),
      ],
      [
        JSON.stringify({
          constraint_name: 'authors_id_uuid_key',
          constraint_type: 'u',
          column_name: 'uuid',
          column_ordinality: 2,
          is_referenceable: true,
          referenced_schema: null,
          referenced_table: null,
          referenced_column_name: null,
          update_action_code: null,
          delete_action_code: null,
        }),
      ],
      [
        JSON.stringify({
          constraint_name: 'authors_uuid_idx',
          constraint_type: 'i',
          column_name: 'uuid',
          column_ordinality: 1,
          is_referenceable: true,
          referenced_schema: null,
          referenced_table: null,
          referenced_column_name: null,
          update_action_code: null,
          delete_action_code: null,
        }),
      ],
    ],
  };
}

/**
 * Serves the schema/table/function listing and the `authors` column+constraint
 * queries that the foreign-key forms issue on mount.
 */
export const databaseAndTableQuery = http.post(
  HASURA_QUERY_URL,
  async ({ request }) => {
    const body = (await request.json()) as {
      args?: { args?: { sql?: string } }[];
    };
    const firstSql: string = body?.args?.[0]?.args?.sql ?? '';

    if (/information_schema.schemata/i.test(firstSql)) {
      return HttpResponse.json([
        databaseResult(),
        tableLikeObjectsResult(),
        functionsResult(),
      ]);
    }

    if (/table_name = 'authors'/i.test(firstSql)) {
      return HttpResponse.json([
        authorsColumnsResult(),
        authorsConstraintsResult(),
      ]);
    }

    return HttpResponse.json([]);
  },
);

export const foreignKeyFormAvailableColumns: DatabaseColumn[] = [
  { name: 'author_id', type: 'uuid' },
  { name: 'editor_id', type: 'uuid' },
];

export async function selectOption(
  combobox: HTMLElement,
  optionName: string,
): Promise<void> {
  const user = new TestUserEvent();
  await user.click(combobox);
  await user.click(await screen.findByRole('option', { name: optionName }));
}
