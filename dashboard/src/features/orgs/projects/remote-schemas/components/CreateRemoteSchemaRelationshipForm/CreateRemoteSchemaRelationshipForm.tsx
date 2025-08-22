import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useCreateRemoteSchemaRelationshipMutation } from '../../hooks/useCreateRemoteSchemaRelationshipMutation';
import {
  getDatabaseRelationshipPayload,
  getRemoteSchemaRelationshipPayload,
} from '../../utils/forms';
import BaseRemoteSchemaRelationshipForm from '../BaseRemoteSchemaRelationshipForm/BaseRemoteSchemaRelationshipForm';
import { DatabaseRelationshipFormValues } from '../BaseRemoteSchemaRelationshipForm/sections/DatabaseRelationshipForm';
import { RemoteSchemaRelationshipFormValues } from '../BaseRemoteSchemaRelationshipForm/sections/RemoteSchemaRelationshipForm';

export interface CreateRemoteSchemaRelationshipFormProps {
  /**
   * The schema name of the remote schema that is being edited.
   */
  schema: string;
  onSubmit?: () => void;
  onCancel?: () => void;
}

export default function CreateRemoteSchemaRelationshipForm({
  schema,
  onSubmit,
  onCancel,
}: CreateRemoteSchemaRelationshipFormProps) {
  const { mutateAsync: createRemoteSchemaRelationship } =
    useCreateRemoteSchemaRelationshipMutation();

  const handleDatabaseRelationshipCreate = async (
    values: DatabaseRelationshipFormValues,
  ) => {
    return execPromiseWithErrorToast(
      async () => {
        const args = getDatabaseRelationshipPayload(values);
        await createRemoteSchemaRelationship({ args });
        onSubmit?.();
      },
      {
        loadingMessage: 'Creating database relationship...',
        successMessage:
          'The database relationship has been created successfully.',
        errorMessage:
          'An error occurred while creating the database relationship. Please try again.',
      },
    );
  };

  const handleRemoteSchemaRelationshipCreate = async (
    values: RemoteSchemaRelationshipFormValues,
  ) => {
    return execPromiseWithErrorToast(
      async () => {
        const args = getRemoteSchemaRelationshipPayload(values);
        await createRemoteSchemaRelationship({ args });
        onSubmit?.();
      },
      {
        loadingMessage: 'Creating remote schema relationship...',
        successMessage:
          'The remote schema relationship has been created successfully.',
        errorMessage:
          'An error occurred while creating the remote schema relationship. Please try again.',
      },
    );
  };

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
      onCancel={onCancel}
      onSubmit={handleSubmit}
      submitButtonText="Create"
    />
  );
}
