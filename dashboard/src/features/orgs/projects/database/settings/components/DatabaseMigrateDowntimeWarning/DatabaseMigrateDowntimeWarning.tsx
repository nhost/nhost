import { Alert } from '@/components/ui/v3/alert';
import { useEstimatedDatabaseMigrationDowntime } from '@/features/orgs/projects/database/common/hooks/useEstimatedDatabaseMigrationDowntime';

export default function DatabaseMigrateDowntimeWarning() {
  const { downtimeShort } = useEstimatedDatabaseMigrationDowntime();

  return (
    <Alert className="flex flex-col gap-3 text-left">
      <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
        <p className="flex items-start gap-1 font-semibold">
          <span>⚠</span> Warning: upgrading Postgres major version
        </p>
        <div className="flex">
          <div className="flex items-center justify-center text-nowrap rounded-full px-2 py-1/2 font-semibold">
            Estimated downtime ~{downtimeShort}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <p>
          Upgrading a major version of Postgres requires downtime. The amount of
          downtime will depend on your database size, so plan ahead in order to
          reduce the impact on your users.
        </p>
        <p>
          Note that it isn&apos;t possible to downgrade between major versions.
        </p>
      </div>
    </Alert>
  );
}
