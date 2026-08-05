import type { GetGraphiteFileStoresQuery } from '@/generated/graphite';

export type GraphiteFileStore = Omit<
  NonNullable<GetGraphiteFileStoresQuery['graphite']>['fileStores'][number],
  '__typename'
>;
