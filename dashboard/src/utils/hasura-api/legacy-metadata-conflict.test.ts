import type { Row } from '@tanstack/react-table';
import createColumn from '@/features/orgs/projects/database/dataGrid/hooks/useCreateColumnMutation/createColumn';
import createColumnMigration from '@/features/orgs/projects/database/dataGrid/hooks/useCreateColumnMutation/createColumnMigration';
import createRecord from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRecordMutation/createRecord';
import createTable from '@/features/orgs/projects/database/dataGrid/hooks/useCreateTableMutation/createTable';
import createTableMigration from '@/features/orgs/projects/database/dataGrid/hooks/useCreateTableMutation/createTableMigration';
import deleteDatabaseObject from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteDatabaseObjectMutation/deleteDatabaseObject';
import deleteDatabaseObjectMigration from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteDatabaseObjectMutation/deleteDatabaseObjectMigration';
import deleteRecord from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteRecordMutation/deleteRecord';
import managePermission from '@/features/orgs/projects/database/dataGrid/hooks/useManagePermissionMutation/managePermission';
import managePermissionMigration from '@/features/orgs/projects/database/dataGrid/hooks/useManagePermissionMutation/managePermissionMigration';
import refreshMaterializedView from '@/features/orgs/projects/database/dataGrid/hooks/useRefreshMaterializedViewMutation/refreshMaterializedView';
import trackForeignKeyRelations from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation/trackForeignKeyRelations';
import trackForeignKeyRelationsMigration from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation/trackForeignKeyRelationsMigration';
import updateColumn from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateColumnMutation/updateColumn';
import updateColumnMigration from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateColumnMutation/updateColumnMigration';
import updateRecord from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRecordMutation/updateRecord';
import updateTable from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateTableMutation/updateTable';
import updateTableMigration from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateTableMutation/updateTableMigration';
import type {
  DataBrowserGridRow,
  DatabaseTable,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import {
  throwIfMetadataVersionConflict,
  throwIfMigrationMetadataVersionConflict,
} from '@/utils/hasura-api/legacy-metadata-conflict';
import { MetadataVersionConflictError } from '@/utils/hasura-api/metadata-version-conflict-error';

const APP_URL = 'https://hasura.example.test';
const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';
const DIRECT_CONFLICT = {
  path: '$',
  error: CONFLICT_MESSAGE,
  code: 'conflict',
};
const MIGRATION_CONFLICT = {
  code: 'data_api_error',
  message: JSON.stringify(DIRECT_CONFLICT),
};
const BASE_OPTIONS = {
  dataSource: 'default',
  schema: 'public',
  table: 'users',
  appUrl: APP_URL,
  adminSecret: 'not-recorded-in-errors',
};
const COLUMN = { id: 'name', name: 'name', type: 'text' };
const RENAMED_COLUMN = { ...COLUMN, name: 'display_name' };
const TABLE: DatabaseTable = {
  name: 'users',
  columns: [{ name: 'id', type: 'uuid' }],
  primaryKey: ['id'],
  foreignKeyRelations: [],
};
const RENAMED_TABLE: DatabaseTable = { ...TABLE, name: 'accounts' };
const FOREIGN_KEY: ForeignKeyRelation = {
  name: 'users_team_id_fkey',
  columnName: 'team_id',
  referencedSchema: 'public',
  referencedTable: 'teams',
  referencedColumn: 'id',
  updateAction: 'RESTRICT',
  deleteAction: 'RESTRICT',
};
const DATA_GRID_ROW = {
  original: { id: 1, name: 'Alice' },
  getAllCells: () => [
    {
      column: {
        id: 'id',
        columnDef: {
          meta: { id: 'id', isPrimary: true, isArray: false },
        },
      },
    },
    {
      column: {
        id: 'name',
        columnDef: {
          meta: { id: 'name', isPrimary: false, isArray: false },
        },
      },
    },
  ],
} as unknown as DataBrowserGridRow;
const DELETE_ROW = {
  original: { id: 1 },
} as unknown as Row<UnknownDataGridRow>;

const fetchMock = vi.fn();

function errorResponse(status: number, data: unknown): Response {
  return {
    ok: false,
    status,
    json: async () => data,
  } as Response;
}

function directCases(): Array<[string, () => Promise<unknown>]> {
  return [
    ['create column', () => createColumn({ ...BASE_OPTIONS, column: COLUMN })],
    [
      'update column',
      () =>
        updateColumn({
          ...BASE_OPTIONS,
          originalColumn: COLUMN,
          column: RENAMED_COLUMN,
        }),
    ],
    ['create table', () => createTable({ ...BASE_OPTIONS, table: TABLE })],
    [
      'update table',
      () =>
        updateTable({
          ...BASE_OPTIONS,
          originalTableName: TABLE.name,
          originalColumns: TABLE.columns,
          originalForeignKeyRelations: [],
          updatedTable: RENAMED_TABLE,
        }),
    ],
    [
      'delete database object',
      () =>
        deleteDatabaseObject({
          ...BASE_OPTIONS,
          schema: 'public',
          objectName: 'users',
          type: 'ORDINARY TABLE',
        }),
    ],
    [
      'create record',
      () =>
        createRecord({
          ...BASE_OPTIONS,
          columnValues: { name: { value: 'Alice' } },
        }),
    ],
    [
      'update record',
      () =>
        updateRecord({
          ...BASE_OPTIONS,
          row: DATA_GRID_ROW,
          columnsToUpdate: { name: { value: 'Bob' } },
        }),
    ],
    [
      'delete record',
      () =>
        deleteRecord({
          ...BASE_OPTIONS,
          selectedRows: [DELETE_ROW],
          primaryOrUniqueColumns: ['id'],
        }),
    ],
    [
      'refresh materialized view',
      () =>
        refreshMaterializedView({
          ...BASE_OPTIONS,
          schema: 'public',
          table: 'user_totals',
        }),
    ],
    [
      'manage permission',
      () =>
        managePermission({
          ...BASE_OPTIONS,
          role: 'user',
          action: 'select',
          resourceVersion: 1,
          mode: 'insert',
          permission: { columns: ['id'] },
        }),
    ],
    [
      'track foreign key relationships',
      () =>
        trackForeignKeyRelations({
          ...BASE_OPTIONS,
          unTrackedForeignKeyRelations: [FOREIGN_KEY],
        }),
    ],
  ];
}

function migrationCases(): Array<[string, () => Promise<unknown>]> {
  return [
    [
      'create column migration',
      () => createColumnMigration({ ...BASE_OPTIONS, column: COLUMN }),
    ],
    [
      'update column migration',
      () =>
        updateColumnMigration({
          ...BASE_OPTIONS,
          originalColumn: COLUMN,
          column: RENAMED_COLUMN,
        }),
    ],
    [
      'create table migration',
      () => createTableMigration({ ...BASE_OPTIONS, table: TABLE }),
    ],
    [
      'update table migration',
      () =>
        updateTableMigration({
          ...BASE_OPTIONS,
          originalTableName: TABLE.name,
          originalColumns: TABLE.columns,
          originalForeignKeyRelations: [],
          updatedTable: RENAMED_TABLE,
        }),
    ],
    [
      'delete database object migration',
      () =>
        deleteDatabaseObjectMigration({
          ...BASE_OPTIONS,
          schema: 'public',
          objectName: 'users',
          type: 'ORDINARY TABLE',
        }),
    ],
    [
      'manage permission migration',
      () =>
        managePermissionMigration({
          ...BASE_OPTIONS,
          role: 'user',
          action: 'select',
          resourceVersion: 1,
          mode: 'insert',
          permission: { columns: ['id'] },
        }),
    ],
    [
      'track foreign key relationships migration',
      () =>
        trackForeignKeyRelationsMigration({
          ...BASE_OPTIONS,
          unTrackedForeignKeyRelations: [FOREIGN_KEY],
        }),
    ],
  ];
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

it('preserves direct legacy conflicts with the configured Hasura origin', () => {
  expect(() =>
    throwIfMetadataVersionConflict({ status: 409 }, DIRECT_CONFLICT, APP_URL),
  ).toThrow(
    expect.objectContaining({
      name: 'MetadataVersionConflictError',
      message: CONFLICT_MESSAGE,
      origin: { appUrl: APP_URL },
    }),
  );
});

it('preserves migration proxy conflicts with the configured Hasura origin', () => {
  expect(() =>
    throwIfMigrationMetadataVersionConflict(
      { status: 400 },
      MIGRATION_CONFLICT,
      APP_URL,
    ),
  ).toThrow(MetadataVersionConflictError);
});

it.each(
  directCases(),
)('preserves conflicts from the raw %s boundary', async (_name, callBoundary) => {
  fetchMock.mockResolvedValueOnce(errorResponse(409, DIRECT_CONFLICT));

  await expect(callBoundary()).rejects.toMatchObject({
    name: 'MetadataVersionConflictError',
    message: CONFLICT_MESSAGE,
    origin: { appUrl: APP_URL },
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each(
  migrationCases(),
)('preserves conflicts from the raw %s boundary', async (_name, callBoundary) => {
  fetchMock.mockResolvedValueOnce(errorResponse(400, MIGRATION_CONFLICT));

  await expect(callBoundary()).rejects.toMatchObject({
    name: 'MetadataVersionConflictError',
    message: CONFLICT_MESSAGE,
    origin: { appUrl: APP_URL },
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, request] = fetchMock.mock.calls[0];
  expect(request).not.toHaveProperty('appUrl');
  expect(JSON.parse(request.body as string)).not.toHaveProperty('appUrl');
});

it.each([
  ['an ordinary direct 409', throwIfMetadataVersionConflict, 409, {}],
  [
    'a direct conflict with the wrong status',
    throwIfMetadataVersionConflict,
    400,
    DIRECT_CONFLICT,
  ],
  [
    'an ordinary migration error',
    throwIfMigrationMetadataVersionConflict,
    400,
    { code: 'data_api_error', message: 'not serialized JSON' },
  ],
])('does not change %s', (_name, guard, status, data) => {
  expect(() => guard({ status }, data, APP_URL)).not.toThrow();
});
