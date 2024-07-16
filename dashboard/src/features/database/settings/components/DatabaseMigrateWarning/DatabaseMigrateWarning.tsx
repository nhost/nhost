import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { useEstimatedDatabaseMigrationDowntime } from '@/features/projects/common/hooks/useEstimatedDatabaseMigrationDowntime';

export default function DatabaseMigrateWarning() {
  const estimatedDowntime = useEstimatedDatabaseMigrationDowntime();

  return (
    <Alert severity="warning" className="flex flex-col gap-2  text-left">
      <div className="flex flex-col gap-2 md:flex-row md:justify-between">
        <Text className="font-semibold">
          ⚠ Warning: upgrading Postgres major version
        </Text>
        <Box
          sx={{
            backgroundColor: 'beige.main',
          }}
          className="py-1/2 flex text-nowrap rounded-full px-4 font-semibold"
        >
          Estimated downtime ~{estimatedDowntime}
        </Box>
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
