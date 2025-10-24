import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteEventTriggerMigrationVariables {
  originalEventTrigger: EventTriggerViewModel;
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
              source: originalEventTrigger.dataSource,
              name: originalEventTrigger.name,
            },
          },
        ],
        down: [
          {
            type: 'pg_create_event_trigger',
            args: {
              name: originalEventTrigger.name,
              table: originalEventTrigger.table,
              source: originalEventTrigger.dataSource,
              webhook: originalEventTrigger.webhook,
              webhook_from_env: originalEventTrigger.webhook_from_env,
              insert: originalEventTrigger.definition.insert,
              update: originalEventTrigger.definition.update,
              delete: originalEventTrigger.definition.delete,
              headers: originalEventTrigger.headers,
              retry_conf: originalEventTrigger.retry_conf,
              replace: false,
              enable_manual: originalEventTrigger.definition.enable_manual,
              request_transform: originalEventTrigger.request_transform,
              trigger_on_replication:
                originalEventTrigger.trigger_on_replication,
            },
          },
        ],
        datasource: originalEventTrigger.dataSource,
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
