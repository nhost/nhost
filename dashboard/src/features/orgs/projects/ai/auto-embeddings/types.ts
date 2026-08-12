import type { GetGraphiteAutoEmbeddingsConfigurationsQuery } from '@/generated/graphite';

export type AutoEmbeddingsConfiguration = Omit<
  GetGraphiteAutoEmbeddingsConfigurationsQuery['graphiteAutoEmbeddingsConfigurations'][0],
  '__typename'
>;
