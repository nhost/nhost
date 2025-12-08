import { useMutation } from '@tanstack/react-query';

import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function useUpdateRemoteRelationshipMutation({
  mutationOptions,
}: UseUpdateRemoteRelationshipMutationOptions = {}) {
  const { project } = useProject();

  return useMutation((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );
  }, mutationOptions);
}
