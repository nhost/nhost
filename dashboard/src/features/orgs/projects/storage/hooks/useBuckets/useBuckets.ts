import { useMemo } from 'react';
import { useGetBucketsQuery } from '@/utils/__generated__/graphql';

const DEFAULT_BUCKET_ID = 'default';

export default function useBuckets() {
  const { data, ...rest } = useGetBucketsQuery();

  const buckets = useMemo(() => {
    const allBuckets = data?.buckets || [];

    const defaultBucket = allBuckets.find(
      (bucket) => bucket.id === DEFAULT_BUCKET_ID,
    );
    const otherBuckets = allBuckets.filter(
      (bucket) => bucket.id !== DEFAULT_BUCKET_ID,
    );

    return defaultBucket ? [defaultBucket, ...otherBuckets] : allBuckets;
  }, [data?.buckets]);

  return { buckets, ...rest };
}
