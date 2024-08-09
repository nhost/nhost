import { Alert } from '@/components/ui/v2/Alert';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { Text } from '@/components/ui/v2/Text';

export default function DatabaseMigrateWarning() {
  return (
    <Alert severity="error" className="flex flex-col gap-3 text-left">
      <Text
        className="flex items-center gap-1 font-semibold"
        sx={{
          color: 'error.main',
        }}
      >
        <XIcon className="h-4 w-4" /> Error: Database version upgrade not
        possible
      </Text>
      <Text
        sx={{
          color: 'error.main',
        }}
      >
        Your project isn&apos;t currently in a healthy state. Please, review
        before proceeding with the upgrade.
      </Text>
    </Alert>
  );
}
