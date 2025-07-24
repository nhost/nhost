import { useState } from 'react';
import type { RemoteSchemaRelationshipType } from '../../types/remoteSchemas';
import DatabaseRelationshipForm, {
  DatabaseRelationshipFormValues,
} from './sections/DatabaseRelationshipForm';
import RelationshipTypeSection from './sections/RelationshipTypeSection';
import RemoteSchemaRelationshipForm, {
  RemoteSchemaRelationshipFormValues,
} from './sections/RemoteSchemaRelationshipForm';

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
}

export default function BaseRemoteSchemaRelationshipForm({
  schema,
  submitButtonText = 'Submit',
  onSubmit,
  onCancel,
  defaultType,
  defaultValues,
}: BaseRemoteSchemaRelationshipFormProps) {
  const [type, setType] = useState<RemoteSchemaRelationshipType>(
    defaultType ?? 'remote-schema',
  );

  return (
    <div className="flex flex-1 flex-col space-y-6 pb-4">
      <RelationshipTypeSection
        disabled={!!defaultType}
        onChange={setType}
        value={type}
      />
      {type === 'remote-schema' && (
        <RemoteSchemaRelationshipForm
          sourceSchema={schema}
          defaultValues={defaultValues}
          onCancel={onCancel}
          onSubmit={onSubmit}
          submitButtonText={submitButtonText}
        />
      )}
      {type === 'database' && (
        <DatabaseRelationshipForm
          sourceSchema={schema}
          defaultValues={defaultValues}
          onCancel={onCancel}
          onSubmit={onSubmit}
          submitButtonText={submitButtonText}
        />
      )}
    </div>
  );
}
