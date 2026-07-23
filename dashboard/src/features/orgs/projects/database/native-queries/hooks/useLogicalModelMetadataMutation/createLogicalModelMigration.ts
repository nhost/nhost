import executeLogicalModelMigration from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/executeLogicalModelMigration';
import { buildCreateLogicalModelMigration } from '@/features/orgs/projects/database/native-queries/utils/logicalModelOperations';
import type { TrackLogicalModelArgs } from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export default function createLogicalModelMigration(
  options: MigrationOperationOptions & { args: TrackLogicalModelArgs },
) {
  return executeLogicalModelMigration(
    buildCreateLogicalModelMigration(options.args),
    options,
  );
}
