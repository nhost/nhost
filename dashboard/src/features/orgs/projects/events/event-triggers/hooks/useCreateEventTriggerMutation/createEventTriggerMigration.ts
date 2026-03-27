import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateEventTriggerArgs,
  DeleteEventTriggerStepArgs,
  MigrationStep,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface CreateEventTriggerMigrationVariables {
  args: CreateEventTriggerArgs;
  originalEventTrigger?: CreateEventTriggerArgs;
}

export default async function createEventTriggerMigration({
  appUrl,
  adminSecret,
  args,
  originalEventTrigger,
}: MigrationOperationOptions & CreateEventTriggerMigrationVariables) {
  try {
    const isEdit = args.replace === true;

    const down: MigrationStep[] =
      isEdit && originalEventTrigger
        ? [
            {
              type: 'pg_create_event_trigger',
              args: {
                ...originalEventTrigger,
                replace: true,
              } satisfies CreateEventTriggerArgs,
            },
          ]
        : [
            {
              type: 'pg_delete_event_trigger',
              args: {
                name: args.name,
                source: args.source,
              } satisfies DeleteEventTriggerStepArgs,
            },
          ];

    const response = await executeMigration(
      {
        name: isEdit
          ? `set_event_trigger_${args.name}`
          : `create_event_trigger_${args.name}`,
        up: [
          {
            type: 'pg_create_event_trigger',
            args,
          },
        ],
        down,
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
