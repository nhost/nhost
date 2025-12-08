import { useCallback, useMemo } from 'react';

import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useUpdateRemoteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRemoteRelationshipMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  CreateRemoteRelationshipArgs,
  RemoteRelationshipDefinition,
  RemoteRelationshipItem,
} from '@/utils/hasura-api/generated/schemas';
import CreateRelationshipDialog, {
  type CreateRelationshipFormValues,
} from './CreateRelationshipDialog';

type MetadataRemoteRelationship = RemoteRelationshipItem & {
  name?: string;
  definition?: RemoteRelationshipDefinition;
};

export interface EditRemoteRelationshipDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  schema: string;
  tableName: string;
  source: string;
  relationship: MetadataRemoteRelationship | null;
  onSuccess?: () => Promise<void> | void;
}

export default function EditRemoteRelationshipDialog({
  open,
  setOpen,
  schema,
  tableName,
  source,
  relationship,
  onSuccess,
}: EditRemoteRelationshipDialogProps) {
  const definition = relationship?.definition;
  const toSourceDefinition =
    definition && 'to_source' in definition ? definition.to_source : null;

  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: updateRemoteRelationship } =
    useUpdateRemoteRelationshipMutation();

  const initialValues = useMemo<CreateRelationshipFormValues | null>(() => {
    if (!relationship || !toSourceDefinition) {
      return null;
    }

    const fieldMappingEntries = Object.entries(
      toSourceDefinition.field_mapping ?? {},
    );

    return {
      name: relationship.name ?? '',
      fromSource: {
        schema,
        table: tableName,
        source,
      },
      toReference: {
        schema: toSourceDefinition.table?.schema ?? '',
        table: toSourceDefinition.table?.name ?? '',
        source: toSourceDefinition.source ?? '',
      },
      relationshipType:
        toSourceDefinition.relationship_type?.toLowerCase() === 'array'
          ? 'array'
          : 'object',
      fieldMapping: fieldMappingEntries.map(
        ([sourceColumn, referenceColumn]) => ({
          sourceColumn,
          referenceColumn,
        }),
      ),
    };
  }, [relationship, toSourceDefinition, schema, source, tableName]);

  const handleUpdateRemoteRelationship = useCallback(
    async (values: CreateRelationshipFormValues) => {
      if (!resourceVersion) {
        throw new Error(
          'Metadata is not ready yet. Please try again in a moment.',
        );
      }

      const columnMappingEntries = values.fieldMapping
        .filter((mapping) => mapping.sourceColumn && mapping.referenceColumn)
        .map(
          (mapping) => [mapping.sourceColumn, mapping.referenceColumn] as const,
        );

      const columnMapping = Object.fromEntries(columnMappingEntries);

      const args: CreateRemoteRelationshipArgs = {
        name: values.name,
        source: values.fromSource.source,
        table: {
          schema: values.fromSource.schema,
          name: values.fromSource.table,
        },
        definition: {
          to_source: {
            relationship_type: values.relationshipType,
            source: values.toReference.source,
            table: {
              schema: values.toReference.schema,
              name: values.toReference.table,
            },
            field_mapping: columnMapping,
          },
        },
      };

      await execPromiseWithErrorToast(
        async () => {
          await updateRemoteRelationship({
            resourceVersion,
            args,
          });
        },
        {
          loadingMessage: 'Saving relationship...',
          successMessage: 'Relationship updated successfully.',
          errorMessage: 'Failed to update relationship.',
        },
      );
    },
    [resourceVersion, updateRemoteRelationship],
  );

  if (!relationship || !toSourceDefinition || !initialValues) {
    return null;
  }

  return (
    <CreateRelationshipDialog
      open={open}
      setOpen={setOpen}
      source={source}
      schema={schema}
      tableName={tableName}
      onSuccess={onSuccess}
      dialogTitle="Edit Relationship"
      dialogDescription="Update the selected remote relationship."
      submitButtonText="Save Changes"
      initialValues={initialValues}
      onSubmitRelationship={handleUpdateRemoteRelationship}
    />
  );
}
