import { Alert } from '@/components/ui/v2/Alert';
import { ClockIcon } from '@/components/ui/v2/icons/ClockIcon';
import { Text } from '@/components/ui/v2/Text';

export default function DatabaseMigrateWarning() {
  return (
    <Alert severity="warning" className="flex flex-col gap-3 text-left">
      <Text className="flex items-center gap-1 font-semibold">
        <ClockIcon className="h-4 w-4" /> An update is in progress
      </Text>
      <Text>You can edit the version only after the update is complete.</Text>
    </Alert>
  );
}
