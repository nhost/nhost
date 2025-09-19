import type { EventTrigger } from '@/utils/hasura-api/generated/schemas';

export interface EventTriggerUI extends EventTrigger {
  dataSource: string;
  table: {
    name: string;
    schema: string;
  };
}
