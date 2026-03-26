import { useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useGetBucketsQuery } from '@/utils/__generated__/graphql';

import type { PermissionPreset } from './types';

export default function usePermissionPresets() {
  const client = useRemoteApplicationGQLClient();
  const { data, loading } = useGetBucketsQuery({ client });

  const buckets = data?.buckets ?? [];

  const presets = useMemo<PermissionPreset[]>(
    () =>
      buckets.flatMap((bucket) => [
        {
          id: bucket.id,
          label: `Rules for "${bucket.id}" bucket`,
          group: 'Buckets',
          createNode: () => ({
            type: 'group' as const,
            id: uuidv4(),
            operator: '_and' as const,
            children: [
              {
                type: 'condition' as const,
                id: uuidv4(),
                column: 'bucket_id',
                operator: '_eq' as const,
                value: bucket.id,
              },
            ],
          }),
        },
        {
          id: `${bucket.id}-own-files`,
          label: `Own files in "${bucket.id}" bucket`,
          group: 'Buckets',
          createNode: () => ({
            type: 'group' as const,
            id: uuidv4(),
            operator: '_and' as const,
            children: [
              {
                type: 'condition' as const,
                id: uuidv4(),
                column: 'bucket_id',
                operator: '_eq' as const,
                value: bucket.id,
              },
              {
                type: 'condition' as const,
                id: uuidv4(),
                column: 'uploaded_by_user_id',
                operator: '_eq' as const,
                value: 'X-Hasura-User-Id',
              },
            ],
          }),
        },
      ]),
    [buckets],
  );

  return { presets, isLoading: loading };
}
