import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import {
  type RemoteSchemaRelationshipDetailsInitialValue,
  type RemoteSchemaRelationshipDetailsValue,
} from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/sections/RemoteSchemaRelationshipDetails';
import { useCreateRemoteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRemoteRelationshipMutation';
import { isToRemoteSchemaRelationshipDefinition } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import useGetRemoteSchemas from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas/useGetRemoteSchemas';
import parseRemoteFieldToSelection from '@/features/orgs/projects/remote-schemas/utils/parseRemoteFieldToSelection';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  RemoteRelationshipDefinition,
  ToRemoteSchemaRelationshipDefinition,
} from '@/utils/hasura-api/generated/schemas';
import { SquarePen } from 'lucide-react';
import { BaseRelationshipDialog } from '../BaseRelationshipDialog';

export interface EditRemoteSchemaRelationshipDialogControlledProps {
  schema: string;
  tableName: string;
  source: string;
  relationshipName: string;
  relationshipDefinition: Extract<
    RemoteRelationshipDefinition,
    { to_remote_schema: ToRemoteSchemaRelationshipDefinition }
  >;
  defaultRemoteSchema?: string;
  onSuccess?: () => Promise<void> | void;
}

export type EditRemoteSchemaRelationshipDialogProps = Omit<
  EditRemoteSchemaRelationshipDialogControlledProps,
  'open' | 'setOpen'
>;

export default function EditRemoteSchemaRelationshipButton({
  schema,
  tableName,
  source,
  relationshipName,
  relationshipDefinition,
  defaultRemoteSchema,
  onSuccess,
}: EditRemoteSchemaRelationshipDialogControlledProps) {
  const [open, setOpen] = useState(false);
  const [selectedRemoteSchema, setSelectedRemoteSchema] = useState('');
  const [remoteFieldDetails, setRemoteFieldDetails] =
    useState<RemoteSchemaRelationshipDetailsValue>({
      lhsFields: [],
      remoteField: undefined,
    });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: remoteSchemas, status: remoteSchemasStatus } =
    useGetRemoteSchemas();

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: createRemoteRelationship, isLoading: isSaving } =
    useCreateRemoteRelationshipMutation();

  // Compute initial value for edit mode
  const initialValue = useMemo<
    RemoteSchemaRelationshipDetailsInitialValue | undefined
  >(() => {
    const relationshipDefinition = relationship?.definition;
    if (
      !relationshipDefinition ||
      !isToRemoteSchemaRelationshipDefinition(relationshipDefinition)
    ) {
      return undefined;
    }

    const parsed = parseRemoteFieldToSelection(
      relationshipDefinition.to_remote_schema.remote_field,
    );
    return {
      rootFieldPath: parsed.rootFieldPath,
      selectedFieldPaths: parsed.selectedFieldPaths,
      argumentMappingsByPath: parsed.argumentMappingsByPath,
    };
  }, [relationship]);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Create mode: preselect the remote schema if provided.
    if (!relationship && defaultRemoteSchema && !selectedRemoteSchema) {
      setSelectedRemoteSchema(defaultRemoteSchema);
    }
  }, [defaultRemoteSchema, open, relationship, selectedRemoteSchema]);

  useEffect(() => {
    const relationshipDefinition = relationship?.definition;
    if (
      !open ||
      !relationshipDefinition ||
      !isToRemoteSchemaRelationshipDefinition(relationshipDefinition)
    ) {
      return;
    }

    const remoteSchemaFromRelationship =
      relationshipDefinition.to_remote_schema.remote_schema ?? '';
    setSelectedRemoteSchema(remoteSchemaFromRelationship);
    setFormError(null);
  }, [open, relationship]);

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormError(null);
      // Reset the create flow when closing.
      if (!relationship) {
        setSelectedRemoteSchema(defaultRemoteSchema ?? '');
        setRemoteFieldDetails({ lhsFields: [], remoteField: undefined });
      }
    }

    setOpen(nextOpen);
  };

  const handleRemoteFieldDetailsChange = useCallback(
    (value: RemoteSchemaRelationshipDetailsValue) => {
      setRemoteFieldDetails(value);
    },
    [],
  );

  const handleSave = async () => {
    if (!resourceVersion) {
      setFormError(
        'Metadata is not ready yet. Please wait a moment and try again.',
      );
      return;
    }

    if (!selectedRemoteSchema) {
      setFormError('Please select a remote schema.');
      return;
    }

    if (!remoteFieldDetails.remoteField) {
      setFormError('Please provide at least one remote field.');
      return;
    }

    const args = {
      name,
      source,
      table: {
        schema,
        name: tableName,
      },
      definition: {
        to_remote_schema: {
          remote_schema: selectedRemoteSchema,
          lhs_fields: remoteFieldDetails.lhsFields,
          remote_field: remoteFieldDetails.remoteField,
        },
      },
    };

    await execPromiseWithErrorToast(
      async () => {
        await createRemoteRelationship({
          resourceVersion,
          args,
        });
        setOpen(false);
        await onSuccess?.();
      },
      {
        loadingMessage: 'Saving relationship...',
        successMessage: 'Relationship updated successfully.',
        errorMessage: 'Failed to update remote relationship.',
      },
    );
  };

  const isRemoteSchemaDefinition = Boolean(
    relationshipDefinition &&
      isToRemoteSchemaRelationshipDefinition(relationshipDefinition),
  );

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
        onSuccess={onSuccess}
        source={source}
        schema={schema}
        tableName={tableName}
        dialogTitle="Edit Remote Schema Relationship"
        dialogDescription="Edit the selected remote schema relationship."
        submitButtonText="Save Changes"
        onSubmit={handleSave}
        initialValues={initialValue}
      />
    </>
  );
}
