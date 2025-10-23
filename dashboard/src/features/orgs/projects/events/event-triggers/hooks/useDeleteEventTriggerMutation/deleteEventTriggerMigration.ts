import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { EventTrigger } from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteEventTriggerMigrationVariables {
  originalEventTrigger: EventTrigger;
}

export async function deleteEventTriggerMigration({
  appUrl,
  adminSecret,
  originalEventTrigger,
}: MigrationOperationOptions & DeleteEventTriggerMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: `delete_et_${originalEventTrigger.name}`,
        up: [
          {
            type: 'pg_delete_event_trigger',
            args: {
              source: 'default', // TODO: this should come from the eventtrigger datasource
              name: originalEventTrigger.name,
            },
          },
        ],
        down: [
          // TODO: add the original event trigger creation step
        ],
        datasource: 'default',
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
