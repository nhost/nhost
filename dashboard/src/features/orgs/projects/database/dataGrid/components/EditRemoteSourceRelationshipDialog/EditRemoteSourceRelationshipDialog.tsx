import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { BaseRelationshipDialog } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog';
import {
  ReferenceSource,
  type BaseRelationshipFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { useCreateRemoteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRemoteRelationshipMutation';
import { isToSourceRelationshipDefinition } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  CreateRemoteRelationshipArgs,
  RemoteRelationshipDefinition,
} from '@/utils/hasura-api/generated/schemas';
import { SquarePen } from 'lucide-react';

export interface EditRemoteSourceRelationshipDialogProps {
  schema: string;
  tableName: string;
  source: string;
  relationshipName: string;
  definition: RemoteRelationshipDefinition;
  onSuccess?: () => Promise<void> | void;
}

export default function EditRemoteSourceRelationshipDialog({
  schema,
  tableName,
  source,
  onSuccess,
  definition,
  relationshipName,
}: EditRemoteSourceRelationshipDialogProps) {
  const [open, setOpen] = useState(false);

  const toSourceDefinition = isToSourceRelationshipDefinition(definition)
    ? definition.to_source
    : null;

  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: createRemoteRelationship } =
    useCreateRemoteRelationshipMutation();

  const initialValues = useMemo<BaseRelationshipFormValues | null>(() => {
    if (!definition || !toSourceDefinition) {
      return null;
    }

    const fieldMappingEntries = Object.entries(
      toSourceDefinition.field_mapping ?? {},
    );

    return {
      name: relationshipName ?? '',
      referenceKind: 'table',
      fromSource: {
        schema,
        table: tableName,
        source,
      },
      toReference: {
        schema: toSourceDefinition.table?.schema ?? '',
        table: toSourceDefinition.table?.name ?? '',
        source: ReferenceSource.createTypeSourceFromName(toSourceDefinition.source ?? '').fullValue,
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
  }, [
    definition,
    toSourceDefinition,
    schema,
    source,
    tableName,
    relationshipName,
  ]);

  const handleUpdateRemoteRelationship = useCallback(
    async (values: BaseRelationshipFormValues) => {
      if (!resourceVersion) {
        throw new Error(
          'Metadata is not ready yet. Please try again in a moment.',
        );
      }

      if (values.referenceKind !== 'table') {
        throw new Error('This dialog only supports table relationships.');
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
          await createRemoteRelationship({
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
    [resourceVersion, createRemoteRelationship],
  );

  if (!definition || !toSourceDefinition || !initialValues) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
      >
        <SquarePen className="size-4" />
      </Button>

      <BaseRelationshipDialog
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
        onSubmit={handleUpdateRemoteRelationship}
      />
    </>
  );
}
