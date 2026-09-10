import { vi } from 'vitest';
import createEventTriggerMigration from '@/features/orgs/projects/events/event-triggers/hooks/useCreateEventTriggerMutation/createEventTriggerMigration';
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

describe('createEventTriggerMigration', () => {
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
      createEventTriggerMigration({
        appUrl: APP_URL,
        adminSecret: 'test-secret',
        args: {
          name: 'user_created',
          table: { schema: 'public', name: 'users' },
          source: 'default',
          webhook: 'https://example.com/webhook',
          webhook_from_env: null,
          insert: { columns: '*' },
          update: null,
          delete: null,
          headers: [],
          retry_conf: {
            num_retries: 0,
            interval_sec: 10,
            timeout_sec: 60,
          },
          replace: false,
          enable_manual: false,
        },
      }),
    ).rejects.toBe(conflict);

    expect(mocks.executeMigration).toHaveBeenCalledWith(expect.anything(), {
      appUrl: APP_URL,
      adminSecret: 'test-secret',
    });
  });
});
