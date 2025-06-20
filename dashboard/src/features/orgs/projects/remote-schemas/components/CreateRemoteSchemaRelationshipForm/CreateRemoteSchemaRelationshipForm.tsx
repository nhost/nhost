import { useState } from 'react';

export interface CreateRemoteSchemaRelationshipFormProps {
  /**
   * The schema name of the remote schema that is being edited.
   */
  schema: string;
}

export default function CreateRemoteSchemaRelationshipForm({
  schema,
}: CreateRemoteSchemaRelationshipFormProps) {
  const [type, setType] = useState<'remote-schema' | 'database'>(
    'remote-schema',
  );

  return <div></div>;
}
