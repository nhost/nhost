import { SquarePen } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { BaseRelationshipDialog } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog';
import type { BaseRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { useCreateRemoteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRemoteRelationshipMutation';
import { isTableRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import parseRemoteRelationshipFormDefaultValues from '@/features/orgs/projects/database/dataGrid/utils/parseRemoteRelationshipFormDefaultValues/parseRemoteRelationshipFormDefaultValues';
import { prepareRemoteSchemaRelationshipDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareRemoteSchemaRelationshipDTO';
import { prepareRemoteSourceRelationshipDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareRemoteSourceRelationshipDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { RemoteRelationshipDefinition } from '@/utils/hasura-api/generated/schemas';

export interface EditRemoteRelationshipButtonProps {
  source: string;
  schema: string;
  tableName: string;
  relationshipName: string;
  relationshipDefinition: RemoteRelationshipDefinition;
}

export default function EditRemoteRelationshipButton({
  source,
  schema,
  tableName,
  relationshipDefinition,
  relationshipName,
}: EditRemoteRelationshipButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: createRemoteRelationship } =
    useCreateRemoteRelationshipMutation();

  const initialValues = parseRemoteRelationshipFormDefaultValues({
    definition: relationshipDefinition,
    relationshipName,
    schema,
    tableName,
    source,
  });

  const handleUpdateRemoteRelationship = useCallback(
    async (values: BaseRelationshipFormValues) => {
      if (!resourceVersion) {
        throw new Error(
          'Metadata is not ready yet. Please try again in a moment.',
        );
      }

      const args = isTableRelationshipFormValues(values)
        ? prepareRemoteSourceRelationshipDTO(values)
        : prepareRemoteSchemaRelationshipDTO(values);

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
        dialogTitle="Edit Relationship"
        dialogDescription="Update the selected remote relationship."
        submitButtonText="Save Changes"
        initialValues={initialValues}
        onSubmit={handleUpdateRemoteRelationship}
        isEditing
      />
    </>
  );
}
