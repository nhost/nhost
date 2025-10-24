import type { CreateEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/CreateEventTriggerForm';
import type { CreateEventTriggerArgs } from '@/utils/hasura-api/generated/schemas';

export default function buildCreateEventTriggerDTO(
  values: CreateEventTriggerFormValues,
): CreateEventTriggerArgs {
  return {
    name: values.triggerName,
    source: values.dataSource,
    table: {
      name: values.tableName,
      schema: values.tableSchema,
    },
    webhook: values.webhook,
    triggerOperations: values.triggerOperations,
  };
}
