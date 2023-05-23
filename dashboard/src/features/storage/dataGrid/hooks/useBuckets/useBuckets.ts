import { useGetBucketsQuery } from '@/utils/__generated__/graphql';

export default function useBuckets(
  props?: FlatArray<Parameters<typeof useGetBucketsQuery>, 1>,
) {
  const { data, ...rest } = useGetBucketsQuery(props);
  const buckets = data?.buckets || [];
  const defaultBucket = buckets.find(({ id }) => id === 'default');

  if (defaultBucket) {
    return { buckets, defaultBucket, ...rest };
  }

  if (buckets.length > 0) {
    return { buckets, defaultBucket: buckets[0], ...rest };
  }

  return { buckets, defaultBucket: null, ...rest };
}
