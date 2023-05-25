import { useGetPlansQuery } from '@/utils/__generated__/graphql';

/**
 * Returns the Pro plan.
 */
export default function useProPlan() {
  const { data, ...rest } = useGetPlansQuery({
    variables: {
      where: {
        name: {
          _eq: 'Pro',
        },
      },
    },
    fetchPolicy: 'cache-first',
  });

  return { data: data?.plans?.at(0), ...rest };
}
