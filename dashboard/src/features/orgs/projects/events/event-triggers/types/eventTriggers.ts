import type { EventTrigger } from '@/utils/hasura-api/generated/schemas';

/**
 * Used for displaying event triggers in the events browser sidebar and event trigger overview.
 */
export interface EventTriggerViewModel extends EventTrigger {
  dataSource: string;
  table: {
    name: string;
    schema: string;
  };
}
