import executeLogicalModelMigration from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/executeLogicalModelMigration';
import { buildDeleteLogicalModelMigration } from '@/features/orgs/projects/database/native-queries/utils/logicalModelOperations';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export default function deleteLogicalModelMigration(
  options: MigrationOperationOptions & { original: LogicalModelItem },
) {
  return executeLogicalModelMigration(
    buildDeleteLogicalModelMigration(options.original),
    options,
  );
}
