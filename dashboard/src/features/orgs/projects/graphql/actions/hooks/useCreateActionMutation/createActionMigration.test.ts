import { vi } from 'vitest';
import createActionMigration, {
  buildCreateActionMigrationRequest,
} from '@/features/orgs/projects/graphql/actions/hooks/useCreateActionMutation/createActionMigration';
import type {
  CreateActionArgs,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import { MetadataVersionConflictError } from '@/utils/hasura-api/metadata-version-conflict-error';

const mocks = vi.hoisted(() => ({
  executeMigration: vi.fn(),
}));

vi.mock('@/utils/hasura-api/migrationFetch', () => ({
  executeMigration: mocks.executeMigration,
}));

const APP_URL = 'http://hasura.local.test:8080';
const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';

const args: CreateActionArgs = {
  name: 'getExchangeRates',
  definition: {
    handler: 'https://example.com',
    output_type: 'ExchangeRatesOutput',
    type: 'query',
    arguments: [{ name: 'base', type: 'String!' }],
  },
  comment: 'Retrieves the exchange rate of a given currency',
};

const customTypes: CustomTypes = {
  objects: [
    {
      name: 'ExchangeRatesOutput',
      fields: [{ name: 'base', type: 'String!' }],
    },
  ],
};

const previousCustomTypes: CustomTypes = {
  objects: [],
};

describe('buildCreateActionMigrationRequest', () => {
  it('names the migration after the action', () => {
    const request = buildCreateActionMigrationRequest({
      args,
      customTypes,
      previousCustomTypes,
    });

    expect(request.name).toBe('create_action_getExchangeRates');
    expect(request.datasource).toBe('default');
    expect(request.skip_execution).toBe(false);
  });

  it('sets the custom types then creates the action on the way up', () => {
    const request = buildCreateActionMigrationRequest({
      args,
      customTypes,
      previousCustomTypes,
    });

    expect(request.up).toEqual([
      { type: 'set_custom_types', args: customTypes },
      { type: 'create_action', args },
    ]);
  });

  it('drops the action then restores the previous custom types on the way down', () => {
    const request = buildCreateActionMigrationRequest({
      args,
      customTypes,
      previousCustomTypes,
    });

    expect(request.down).toEqual([
      { type: 'drop_action', args: { name: 'getExchangeRates' } },
      { type: 'set_custom_types', args: previousCustomTypes },
    ]);
  });
});

describe('createActionMigration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves a typed metadata conflict from the migration boundary', async () => {
    const conflict = new MetadataVersionConflictError(
      CONFLICT_MESSAGE,
      APP_URL,
    );
    mocks.executeMigration.mockRejectedValue(conflict);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      createActionMigration({
        appUrl: APP_URL,
        adminSecret: 'test-secret',
        args,
        customTypes,
        previousCustomTypes,
      }),
    ).rejects.toBe(conflict);

    expect(mocks.executeMigration).toHaveBeenCalledWith(expect.anything(), {
      appUrl: APP_URL,
      adminSecret: 'test-secret',
    });
  });
});
