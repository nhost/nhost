import { useState } from 'react';
import type { RemoteSchemaRelationshipType } from '@/features/orgs/projects/remote-schemas/types/remoteSchemas';
import type { DatabaseRelationshipFormValues } from './sections/DatabaseRelationshipForm';
import DatabaseRelationshipForm from './sections/DatabaseRelationshipForm';
import RelationshipTypeSection from './sections/RelationshipTypeSection';
import type { RemoteSchemaRelationshipFormValues } from './sections/RemoteSchemaRelationshipForm';
import RemoteSchemaRelationshipForm from './sections/RemoteSchemaRelationshipForm';

export interface BaseRemoteSchemaRelationshipFormProps {
  /**
   * The schema name of the remote schema that is being edited.
   */
  schema: string;
  /**
   * The text to display on the submit button.
   */
  submitButtonText?: string;
  /**
   * If provided, the form will be pre-filled with the default type, and the type section will be disabled. Used for editing existing relationships.
   */
  defaultType?: RemoteSchemaRelationshipType;
  defaultValues?:
    | DatabaseRelationshipFormValues
    | RemoteSchemaRelationshipFormValues;
  onSubmit?: (
    values: DatabaseRelationshipFormValues | RemoteSchemaRelationshipFormValues,
  ) => void;
  onCancel?: () => void;
  disabled?: boolean;
  /**
   * Whether the name input is disabled.
   */
  nameInputDisabled?: boolean;
}

export default function BaseRemoteSchemaRelationshipForm({
  schema,
  submitButtonText = 'Submit',
  onSubmit,
  onCancel,
  defaultType,
  defaultValues,
  disabled,
  nameInputDisabled,
}: BaseRemoteSchemaRelationshipFormProps) {
  const [type, setType] = useState<RemoteSchemaRelationshipType>(
    defaultType ?? 'remote-schema',
  );

  return (
    <div className="flex flex-1 flex-col space-y-6 pb-4">
      <RelationshipTypeSection
        disabled={!!defaultType || disabled}
        onChange={setType}
        value={type}
      />
      {type === 'remote-schema' && (
        <RemoteSchemaRelationshipForm
          sourceSchema={schema}
          defaultValues={
            defaultType === 'remote-schema'
              ? (defaultValues as
                  | RemoteSchemaRelationshipFormValues
                  | undefined)
              : undefined
          }
          onCancel={onCancel}
          onSubmit={(values) => onSubmit?.(values)}
          submitButtonText={submitButtonText}
          disabled={disabled}
          nameInputDisabled={nameInputDisabled}
        />
      )}
      {type === 'database' && (
        <DatabaseRelationshipForm
          sourceSchema={schema}
          defaultValues={
            defaultType === 'database'
              ? (defaultValues as DatabaseRelationshipFormValues | undefined)
              : undefined
          }
          onCancel={onCancel}
          onSubmit={(values) => onSubmit?.(values)}
          submitButtonText={submitButtonText}
          disabled={disabled}
          nameInputDisabled={nameInputDisabled}
        />
      )}
    </div>
  );
}
