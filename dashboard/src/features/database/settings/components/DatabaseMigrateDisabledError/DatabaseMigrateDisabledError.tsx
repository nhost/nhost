import { Alert } from '@/components/ui/v2/Alert';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { Text } from '@/components/ui/v2/Text';

export default function DatabaseMigrateWarning() {
  return (
    <Alert severity="error" className="flex flex-col gap-3 text-left">
      <Text className="font-semibold" sx={{
        color: 'error.main',
      }}>
        <XIcon className="w-4 h-4"/> Error: Database version upgrade not possible
      </Text>
      <Text sx={{
        color: 'error.main'
      }}>
        Error deploying the project most likely due to invalid configuration. A
        database version upgrade is not possible. Please review your project’s
        configuration and logs for more information.
      </Text>
    </Alert>
  );
}
