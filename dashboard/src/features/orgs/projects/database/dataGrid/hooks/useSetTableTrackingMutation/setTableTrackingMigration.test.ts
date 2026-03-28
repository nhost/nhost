import { vi } from 'vitest';
import setTableTrackingMigration from './setTableTrackingMigration';

const mocks = vi.hoisted(() => ({
  executeMigration: vi.fn(),
}));

vi.mock('@/utils/hasura-api/generated/default/default', () => ({
  executeMigration: mocks.executeMigration,
}));

const baseOptions = {
  appUrl: 'https://test.hasura.app',
  adminSecret: 'test-secret',
};

const tableArgs = {
  table: { schema: 'public', name: 'users' },
  source: 'default',
};

describe('setTableTrackingMigration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('constructs a track migration with correct name, up, and down steps', async () => {
    mocks.executeMigration.mockResolvedValue({
      status: 200,
      data: { message: 'success' },
    });

    await setTableTrackingMigration({
      ...baseOptions,
      tracked: true,
      args: tableArgs,
    });

    expect(mocks.executeMigration).toHaveBeenCalledWith(
      {
        name: 'add_existing_table_or_view_public_users',
        up: [{ type: 'pg_track_table', args: tableArgs }],
        down: [{ type: 'pg_untrack_table', args: tableArgs }],
        datasource: 'default',
        skip_execution: false,
      },
      { baseUrl: baseOptions.appUrl, adminSecret: baseOptions.adminSecret },
    );
  });

  it('constructs an untrack migration with correct name, up, and down steps', async () => {
    mocks.executeMigration.mockResolvedValue({
      status: 200,
      data: { message: 'success' },
    });

    await setTableTrackingMigration({
      ...baseOptions,
      tracked: false,
      args: tableArgs,
    });

    expect(mocks.executeMigration).toHaveBeenCalledWith(
      {
        name: 'remove_existing_table_or_view_public_users',
        up: [{ type: 'pg_untrack_table', args: tableArgs }],
        down: [{ type: 'pg_track_table', args: tableArgs }],
        datasource: 'default',
        skip_execution: false,
      },
      { baseUrl: baseOptions.appUrl, adminSecret: baseOptions.adminSecret },
    );
  });

  it('defaults source to "default" when args.source is undefined', async () => {
    mocks.executeMigration.mockResolvedValue({
      status: 200,
      data: { message: 'success' },
    });

    const argsWithoutSource = {
      table: { schema: 'public', name: 'orders' },
    };

    await setTableTrackingMigration({
      ...baseOptions,
      tracked: true,
      args: argsWithoutSource,
    });

    expect(mocks.executeMigration).toHaveBeenCalledWith(
      expect.objectContaining({ datasource: 'default' }),
      expect.anything(),
    );
  });

  it('throws when response status is not 200', async () => {
    mocks.executeMigration.mockResolvedValue({
      status: 500,
      data: { error: 'internal error' },
    });

    await expect(
      setTableTrackingMigration({
        ...baseOptions,
        tracked: true,
        args: tableArgs,
      }),
    ).rejects.toThrow('internal error');
  });

  it('returns response data on success', async () => {
    const responseData = { message: 'success' };
    mocks.executeMigration.mockResolvedValue({
      status: 200,
      data: responseData,
    });

    const result = await setTableTrackingMigration({
      ...baseOptions,
      tracked: true,
      args: tableArgs,
    });

    expect(result).toEqual(responseData);
  });
});
