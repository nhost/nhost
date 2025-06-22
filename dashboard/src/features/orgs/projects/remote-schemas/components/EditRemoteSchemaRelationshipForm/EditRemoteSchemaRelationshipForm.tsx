import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem } from '@/utils/hasura-api/generated/schemas/remoteSchemaInfoRemoteRelationshipsItemRelationshipsItem';
import { useUpdateRemoteSchemaRelationshipMutation } from '../../hooks/useUpdateRemoteSchemaRelationshipMutation';
import {
  getDatabaseRelationshipPayload,
  getRelationshipFormDefaultValues,
  getRelationshipType,
  getRemoteSchemaRelationshipPayload,
} from '../../utils/forms';
import BaseRemoteSchemaRelationshipForm from '../BaseRemoteSchemaRelationshipForm/BaseRemoteSchemaRelationshipForm';
import { DatabaseRelationshipFormValues } from '../BaseRemoteSchemaRelationshipForm/sections/DatabaseRelationshipForm';
import { RemoteSchemaRelationshipFormValues } from '../BaseRemoteSchemaRelationshipForm/sections/RemoteSchemaRelationshipForm';

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
}

export default function EditRemoteSchemaRelationshipForm({
  schema,
  relationship,
  typeName,
  onSubmit,
  onCancel,
}: EditRemoteSchemaRelationshipFormProps) {
  const { mutateAsync: updateRemoteSchemaRelationship } =
    useUpdateRemoteSchemaRelationshipMutation();

  const handleDatabaseRelationshipCreate = async (
    values: DatabaseRelationshipFormValues,
  ) => {
    await execPromiseWithErrorToast(
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
  };

  const handleRemoteSchemaRelationshipCreate = async (
    values: RemoteSchemaRelationshipFormValues,
  ) => {
    await execPromiseWithErrorToast(
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
  };

  const handleSubmit = (
    values: DatabaseRelationshipFormValues | RemoteSchemaRelationshipFormValues,
  ) => {
    if ('table' in values) {
      handleDatabaseRelationshipCreate(values);
    } else {
      handleRemoteSchemaRelationshipCreate(values);
    }
  };

  console.log(
    'getRelationshipFormDefaultValues',
    getRelationshipFormDefaultValues(relationship, schema, typeName),
  );

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
    />
  );
}
