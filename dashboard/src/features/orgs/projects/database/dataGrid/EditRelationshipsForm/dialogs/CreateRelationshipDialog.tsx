import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useCreateArrayRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateArrayRelationshipMutation';
import { useCreateObjectRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateObjectRelationshipMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  CreateArrayRelationshipArgs,
  CreateObjectRelationshipArgs,
} from '@/utils/hasura-api/generated/schemas';
import {
  type BaseRelationshipDialogProps,
  type RelationshipFormValues,
  BaseRelationshipDialog,
} from './BaseRelationshipDialog';

export default function CreateRelationshipDialog(
  props: Omit<
    BaseRelationshipDialogProps,
    'isSubmitting' | 'onSubmitRelationship'
  >,
) {
  const queryClient = useQueryClient();
  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const {
    mutateAsync: createArrayRelationship,
    isLoading: isCreatingArrayRelationship,
  } = useCreateArrayRelationshipMutation();
  const {
    mutateAsync: createObjectRelationship,
    isLoading: isCreatingObjectRelationship,
  } = useCreateObjectRelationshipMutation();

  const isCreatingRelationship =
    isCreatingArrayRelationship || isCreatingObjectRelationship;

  const handleCreateRelationship = async (values: RelationshipFormValues) => {
    if (!resourceVersion) {
      return;
    }

    const baseTable = {
      schema: values.fromSource.schema,
      name: values.fromSource.table,
    };

    const relationshipSource = values.fromSource.source;

    const remoteTable = {
      schema: values.toReference.schema,
      name: values.toReference.table,
    };

    const columnMappingEntries = values.fieldMapping
      .filter((mapping) => mapping.sourceColumn && mapping.referenceColumn)
      .map((mapping) => [mapping.sourceColumn, mapping.referenceColumn]);

    const columnMapping = Object.fromEntries(columnMappingEntries);

    let promise: Promise<unknown> | undefined;

    if (values.relationshipType === 'array') {
      const remoteColumns = values.fieldMapping
        .map((mapping) => mapping.referenceColumn)
        .filter(Boolean);

      const foreignKeyColumn = remoteColumns[0];

      if (!foreignKeyColumn) {
        return;
      }

      const args: CreateArrayRelationshipArgs = {
        table: baseTable,
        name: values.name,
        source: values.fromSource.source,
        using: {
          foreign_key_constraint_on: {
            table: remoteTable,
            columns: [foreignKeyColumn],
          },
        },
      };

      promise = createArrayRelationship({
        resourceVersion,
        args,
      });
    } else {
      const args: CreateObjectRelationshipArgs = {
        table: baseTable,
        name: values.name,
        source: values.fromSource.source,
        using: {
          manual_configuration: {
            remote_table: remoteTable,
            column_mapping: columnMapping,
          },
        },
      };

      promise = createObjectRelationship({
        resourceVersion,
        args,
      });
    }

    if (!promise) {
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await promise;
      },
      {
        loadingMessage: 'Creating relationship...',
        successMessage: 'Relationship created successfully.',
        errorMessage: 'An error occurred while creating the relationship.',
      },
    );

    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: ['export-metadata'],
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: ['suggest-relationships', relationshipSource],
      }),
    ]);
  };

  return (
    <BaseRelationshipDialog
      {...props}
      isSubmitting={isCreatingRelationship}
      onSubmitRelationship={handleCreateRelationship}
    />
  );
}

export function CreateRelationshipDialogWithTrigger(
  props: Omit<
    Omit<BaseRelationshipDialogProps, 'isSubmitting' | 'onSubmitRelationship'>,
    'open' | 'setOpen'
  >,
) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="default"
        className="mt-2 flex w-fit items-center gap-2 sm:mt-0"
        onClick={() => setOpen(true)}
      >
        Relationship
        <PlusIcon className="h-4 w-4" />
      </Button>

      <CreateRelationshipDialog {...props} open={open} setOpen={setOpen} />
    </>
  );
}
