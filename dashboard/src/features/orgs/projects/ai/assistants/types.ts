import type {
  GetAssistantsQuery,
  GetGraphiteFileStoresQuery,
} from '@/generated/graphite';

export type Assistant = Omit<
  NonNullable<GetAssistantsQuery['graphite']>['assistants'][number],
  '__typename'
>;

export type GraphiteFileStore = Omit<
  NonNullable<GetGraphiteFileStoresQuery['graphite']>['fileStores'][number],
  '__typename'
>;
