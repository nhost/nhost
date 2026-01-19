import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { BaseRelationshipDialog } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog';
import type { BaseRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { useCreateArrayRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateArrayRelationshipMutation';
import { useCreateObjectRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateObjectRelationshipMutation';
import { useCreateRemoteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRemoteRelationshipMutation';
import { isRemoteSchemaRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import { prepareLocalRelationshipDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareLocalRelationshipDTO';
import { prepareRemoteSchemaRelationshipDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareRemoteSchemaRelationshipDTO';
import { prepareRemoteSourceRelationshipDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareRemoteSourceRelationshipDTO';
import { triggerToast } from '@/utils/toast';

interface CreateRelationshipDialogProps {
  source: string;
  schema: string;
  tableName: string;
}

export default function CreateRelationshipDialog({
  source,
  schema,
  tableName,
}: CreateRelationshipDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: createArrayRelationship } =
    useCreateArrayRelationshipMutation();
  const { mutateAsync: createObjectRelationship } =
    useCreateObjectRelationshipMutation();
  const { mutateAsync: createRemoteRelationship } =
    useCreateRemoteRelationshipMutation();

  const handleCreateRelationship = async (
    values: BaseRelationshipFormValues,
  ) => {
    if (!resourceVersion) {
      triggerToast('Metadata is not ready yet. Please try again in a moment.');
      return;
    }

    try {
      const toReferenceSource = values.toReference.source;

      if (isRemoteSchemaRelationshipFormValues(values)) {
        const args = prepareRemoteSchemaRelationshipDTO(values);
        await createRemoteRelationship({
          resourceVersion,
          args,
        });
      } else if (toReferenceSource !== source) {
        const args = prepareRemoteSourceRelationshipDTO(values);
        await createRemoteRelationship({
          resourceVersion,
          args,
        });
      } else {
        const args = prepareLocalRelationshipDTO(values);
        const createLocalRelationship =
          values.relationshipType === 'array'
            ? createArrayRelationship
            : createObjectRelationship;

        await createLocalRelationship({
          resourceVersion,
          args,
        });
      }
      triggerToast('Relationship created successfully.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create relationship.';
      triggerToast(`Error: ${message}`);
      throw error;
    }
  };

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
      <BaseRelationshipDialog
        source={source}
        schema={schema}
        tableName={tableName}
        dialogTitle="Create Relationship"
        dialogDescription="Create and track a new relationship in your GraphQL schema."
        submitButtonText="Create Relationship"
        onSubmit={handleCreateRelationship}
        open={open}
        setOpen={setOpen}
      />
    </>
  );
}
