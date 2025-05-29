import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useMetadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { MutationOptions } from '@tanstack/react-query';
import type { ErrorResponse } from '../generated/schemas/errorResponse';
import type { MetadataOperation200 } from '../generated/schemas/metadataOperation200';
import type { MetadataOperationBody } from '../generated/schemas/metadataOperationBody';
import { createHasuraContext } from '../hasura-mutator';

export interface UseHasuraMetadataOperationOptions {
  /**
   * Custom app URL to use instead of the project's URL
   */
  appUrl?: string;
  /**
   * Custom admin secret to use instead of the project's admin secret
   */
  adminSecret?: string;
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    ErrorResponse,
    { data: MetadataOperationBody }
  >;
}

/**
 * More idiomatic hook that follows the pattern from useCreateTableMutation.ts
 * Handles project context automatically while allowing overrides.
 */
export function useHasuraMetadataOperation({
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseHasuraMetadataOperationOptions = {}) {
  const { project } = useProject();

  // Build context using the same pattern as other mutation hooks
  const hasuraContext = createHasuraContext(project);

  // Override with custom values if provided
  const finalContext = {
    ...hasuraContext,
    ...(customAppUrl && { appUrl: customAppUrl }),
    ...(customAdminSecret && { adminSecret: customAdminSecret }),
  };

  return useMetadataOperation({
    request: {
      hasuraContext: finalContext,
    },
    mutation: mutationOptions,
  });
}
