import BaseRemoteSchemaRelationshipForm from '@/features/orgs/projects/remote-schemas/components/BaseRemoteSchemaRelationshipForm/BaseRemoteSchemaRelationshipForm';
import type { DatabaseRelationshipFormValues } from '@/features/orgs/projects/remote-schemas/components/BaseRemoteSchemaRelationshipForm/sections/DatabaseRelationshipForm';
import type { RemoteSchemaRelationshipFormValues } from '@/features/orgs/projects/remote-schemas/components/BaseRemoteSchemaRelationshipForm/sections/RemoteSchemaRelationshipForm';
import { useUpdateRemoteSchemaRelationshipMutation } from '@/features/orgs/projects/remote-schemas/hooks/useUpdateRemoteSchemaRelationshipMutation';
import {
  getDatabaseRelationshipPayload,
  getRelationshipFormDefaultValues,
  getRelationshipType,
  getRemoteSchemaRelationshipPayload,
} from '@/features/orgs/projects/remote-schemas/utils/forms';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem } from '@/utils/hasura-api/generated/schemas/remoteSchemaInfoRemoteRelationshipsItemRelationshipsItem';

export interface EditRemoteSchemaRelationshipFormProps {
  /**
   * The schema name of the remote schema that is being edited.
   */
  schema: string;
  /**
   * The relationship to be edited.
   */
  relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem;
  /**
   * The type name of the relationship.
   */
  typeName: string;
  onSubmit?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  /**
   * Whether the name input is disabled.
   */
  nameInputDisabled?: boolean;
}

export default function EditRemoteSchemaRelationshipForm({
  schema,
  relationship,
  typeName,
  onSubmit,
  onCancel,
  disabled,
  nameInputDisabled,
}: EditRemoteSchemaRelationshipFormProps) {
  const { mutateAsync: updateRemoteSchemaRelationship } =
    useUpdateRemoteSchemaRelationshipMutation();

  const handleDatabaseRelationshipCreate = async (
    values: DatabaseRelationshipFormValues,
  ) =>
    execPromiseWithErrorToast(
      async () => {
        const args = getDatabaseRelationshipPayload(values);
        await updateRemoteSchemaRelationship({ args });
        onSubmit?.();
      },
      {
        loadingMessage: 'Saving database relationship...',
        successMessage:
          'The database relationship has been saved successfully.',
        errorMessage:
          'An error occurred while saving the database relationship. Please try again.',
      },
    );

  const handleRemoteSchemaRelationshipCreate = async (
    values: RemoteSchemaRelationshipFormValues,
  ) =>
    execPromiseWithErrorToast(
      async () => {
        const args = getRemoteSchemaRelationshipPayload(values);
        await updateRemoteSchemaRelationship({ args });
        onSubmit?.();
      },
      {
        loadingMessage: 'Saving remote schema relationship...',
        successMessage:
          'The remote schema relationship has been saved successfully.',
        errorMessage:
          'An error occurred while saving the remote schema relationship. Please try again.',
      },
    );

  const handleSubmit = (
    values: DatabaseRelationshipFormValues | RemoteSchemaRelationshipFormValues,
  ) => {
    if ('table' in values) {
      return handleDatabaseRelationshipCreate(values);
    }
    return handleRemoteSchemaRelationshipCreate(values);
  };

  return (
    <BaseRemoteSchemaRelationshipForm
      schema={schema}
      defaultType={getRelationshipType(relationship)}
      defaultValues={getRelationshipFormDefaultValues(
        relationship,
        schema,
        typeName,
      )}
      onSubmit={handleSubmit}
      submitButtonText="Save"
      onCancel={onCancel}
      disabled={disabled}
      nameInputDisabled={nameInputDisabled}
    />
  );
}
