import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useGetPlansQuery } from '@/utils/__generated__/graphql';

/**
 * Returns the Pro plan.
 */
export default function useProPlan() {
  const isPlatform = useIsPlatform();

  const { data, ...rest } = useGetPlansQuery({
    variables: {
      where: {
        name: {
          _eq: 'Pro',
        },
      },
    },
    fetchPolicy: 'cache-first',
    skip: !isPlatform,
  });

  return { data: data?.plans?.at(0), ...rest };
}
