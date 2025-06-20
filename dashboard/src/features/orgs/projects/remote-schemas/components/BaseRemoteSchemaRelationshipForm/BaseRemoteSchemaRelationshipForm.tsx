import { useState } from 'react';
import DatabaseRelationshipForm from './sections/DatabaseRelationshipForm';
import RelationshipTypeSection from './sections/RelationshipTypeSection';

export interface BaseRemoteSchemaRelationshipFormProps {
  /**
   * The schema name of the remote schema that is being edited.
   */
  schema: string;
}

export default function BaseRemoteSchemaRelationshipForm({
  schema,
}: BaseRemoteSchemaRelationshipFormProps) {
  const [type, setType] = useState<'remote-schema' | 'database'>('database');

  const handleDatabaseRelationshipSubmit = (values: any) => {
    console.log('Database relationship submitted for schema:', schema, values);
    // TODO: Implement actual submission logic
    // This could involve API calls, state updates, etc.
  };

  return (
    <div className="space-y-6 px-6">
      <RelationshipTypeSection onChange={setType} value={type} />
      {type === 'database' && (
        <DatabaseRelationshipForm
          sourceSchema={schema}
          onSubmit={handleDatabaseRelationshipSubmit}
        />
      )}
      {type === 'remote-schema' && (
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">
            Remote schema relationships are not yet implemented.
          </p>
        </div>
      )}
    </div>
  );
}
