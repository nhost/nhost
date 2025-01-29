import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { useEstimatedDatabaseMigrationDowntime } from '@/features/database/common/hooks/useEstimatedDatabaseMigrationDowntime';

export default function DatabaseMigrateDowntimeWarning() {
  const { downtimeShort } = useEstimatedDatabaseMigrationDowntime();

  return (
    <Alert severity="warning" className="flex flex-col gap-3 text-left">
      <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
        <Text className="flex items-start gap-1 font-semibold">
          <span>⚠</span> Warning: upgrading Postgres major version
        </Text>
        <div className="flex">
          <Box
            sx={{
              backgroundColor: 'beige.main',
            }}
            className="py-1/2 flex items-center justify-center text-nowrap rounded-full px-2 font-semibold"
          >
            Estimated downtime ~{downtimeShort}
          </Box>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Text>
          Upgrading a major version of Postgres requires downtime. The amount of
          downtime will depend on your database size, so plan ahead in order to
          reduce the impact on your users.
        </Text>
        <Text>
          Note that it isn&apos;t possible to downgrade between major versions.
        </Text>
      </div>
    </Alert>
  );
}
