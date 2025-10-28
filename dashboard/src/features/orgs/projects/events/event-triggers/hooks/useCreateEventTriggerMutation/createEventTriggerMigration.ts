import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateEventTriggerArgs,
  DeleteEventTriggerStepArgs,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface CreateEventTriggerMigrationVariables {
  args: CreateEventTriggerArgs;
}

export default async function createEventTriggerMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & CreateEventTriggerMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: `create_event_trigger_${args.name}`,
        up: [
          {
            type: 'pg_create_event_trigger',
            args: {
              ...args,
              replace: false,
            } satisfies CreateEventTriggerArgs,
          },
        ],
        down: [
          {
            type: 'pg_delete_event_trigger',
            args: {
              name: args.name,
              source: args.source,
            } satisfies DeleteEventTriggerStepArgs,
          },
        ],
        datasource: args.source ?? 'default',
        skip_execution: false,
      },
      {
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data?.message ?? 'Unknown error');
  } catch (error) {
    console.error(error);
    throw error;
  }
}
