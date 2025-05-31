import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';

export interface RemoteSchemaDetailsProps {
  remoteSchema: RemoteSchemaInfo;
}

export default function RemoteSchemaDetails({
  remoteSchema,
}: RemoteSchemaDetailsProps) {
  return (
    <div>
      <h1>Remote Schema Details</h1>
      <pre>{JSON.stringify(remoteSchema, null, 2)}</pre>
    </div>
  );
}
