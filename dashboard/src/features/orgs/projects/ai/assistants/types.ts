import type { GetAssistantsQuery } from '@/generated/graphite';

export type Assistant = Omit<
  NonNullable<GetAssistantsQuery['graphite']>['assistants'][number],
  '__typename'
>;
