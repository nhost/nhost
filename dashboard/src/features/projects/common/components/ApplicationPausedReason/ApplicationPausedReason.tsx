import { Alert } from '@/components/ui/v2/Alert';
import { Text } from '@/components/ui/v2/Text';

interface ApplicationPausedReasonProps {
  freeAndLiveProjectsNumberExceeded?: boolean;
}

export default function ApplicationPausedReason({
  freeAndLiveProjectsNumberExceeded,
}: ApplicationPausedReasonProps) {
  return (
    <Alert
      severity="warning"
      className="mx-auto flex max-w-xs flex-col gap-4 p-6 text-left"
    >
      <Text>
        Starter projects will stop responding to API calls after 7 days of
        inactivity, so consider
        <span className="font-semibold"> upgrading to Pro </span>to avoid
        auto-sleep.
      </Text>
      {freeAndLiveProjectsNumberExceeded && (
        <Text>
          Additionally, only 1 free project can be active at any given time, so
          please pause your current active free project before unpausing
          another.
        </Text>
      )}
    </Alert>
  );
}
