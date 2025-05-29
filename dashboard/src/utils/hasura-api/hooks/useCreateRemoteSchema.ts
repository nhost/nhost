import type { AddRemoteSchemaArgs } from '@/utils/hasura-api/generated/schemas/addRemoteSchemaArgs';
import { useHasuraMetadataOperation } from './useHasuraMetadataOperation';

export interface CreateRemoteSchemaVariables {
  name: string;
  definition: AddRemoteSchemaArgs['definition'];
  comment?: string;
}

export function useCreateRemoteSchema() {
  const { mutate, ...rest } = useHasuraMetadataOperation();

  const createRemoteSchema = (variables: CreateRemoteSchemaVariables) => {
    mutate({
      data: {
        type: 'add_remote_schema',
        args: {
          name: variables.name,
          definition: variables.definition,
          comment: variables.comment,
        },
      },
    });
  };

  return {
    createRemoteSchema,
    ...rest,
  };
}
