import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { BaseRelationshipDialog } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog';
import {
  ReferenceSource,
  type BaseRelationshipFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { useCreateArrayRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateArrayRelationshipMutation';
import { useCreateObjectRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateObjectRelationshipMutation';
import { useCreateRemoteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRemoteRelationshipMutation';
import { isRemoteSchemaRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import { prepareArrayRelationshipDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareArrayRelationshipDTO';
import { prepareObjectRelationshipDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareObjectRelationshipDTO';
import { prepareRemoteSchemaRelationshipDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareRemoteSchemaRelationshipDTO';
import { prepareRemoteSourceRelationshipDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareRemoteSourceRelationshipDTO';
import { triggerToast } from '@/utils/toast';

interface CreateRelationshipDialogProps {
  source: string;
  schema: string;
  tableName: string;
  onRelationshipCreated?: () => Promise<void> | void;
}

export default function CreateRelationshipDialog({
  source,
  schema,
  tableName,
  onRelationshipCreated,
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
      return;
    }

    try {
      const toReferenceSource = new ReferenceSource(values.toReference.source);

      if (isRemoteSchemaRelationshipFormValues(values)) {
        const args = prepareRemoteSchemaRelationshipDTO(values);
        await createRemoteRelationship({
          resourceVersion,
          args,
        });
      } else if (toReferenceSource.name !== source) {
        const args = prepareRemoteSourceRelationshipDTO(values);
        await createRemoteRelationship({
          resourceVersion,
          args,
        });
      } else if (values.relationshipType === 'array') {
        const args = prepareArrayRelationshipDTO(values);
        await createArrayRelationship({
          resourceVersion,
          args,
        });
      } else {
        const args = prepareObjectRelationshipDTO(values);
        await createObjectRelationship({
          resourceVersion,
          args,
        });
      }
      triggerToast('Relationship created successfully.');
      onRelationshipCreated?.();
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
