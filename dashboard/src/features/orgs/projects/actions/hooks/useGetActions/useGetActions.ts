import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type {
  ActionItem,
  CustomTypes,
  ExportMetadataResponse,
} from '@/utils/hasura-api/generated/schemas';

export interface ActionsMetadata {
  actions: ActionItem[];
  customTypes: CustomTypes;
}

function selectActions(data: ExportMetadataResponse): ActionsMetadata {
  return {
    actions: data.metadata?.actions ?? [],
    customTypes: data.metadata?.custom_types ?? {},
  };
}

/**
 * This hook is a wrapper around a fetch call that gets the actions and the
 * custom types from the metadata.
 *
 * @returns The result of the query.
 */
export default function useGetActions() {
  return useExportMetadata(selectActions);
}
