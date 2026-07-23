import executeLogicalModelMigration from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/executeLogicalModelMigration';
import { buildEditLogicalModelMigration } from '@/features/orgs/projects/database/native-queries/utils/logicalModelOperations';
import type {
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export default function editLogicalModelMigration(
  options: MigrationOperationOptions & {
    args: TrackLogicalModelArgs;
    original: LogicalModelItem;
  },
) {
  return executeLogicalModelMigration(
    buildEditLogicalModelMigration(options.args, options.original),
    options,
  );
}
