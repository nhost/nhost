import { ArrowRightIcon } from '@/components/ui/v2/icons/ArrowRightIcon';
import type { RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem } from '@/utils/hasura-api/generated/schemas';

interface RelationshipTableCellProps {
  relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem;
}

export default function RelationshipTableCell({
  relationship,
}: RelationshipTableCellProps) {
  return (
    <div>
      <ArrowRightIcon />
    </div>
  );
}
