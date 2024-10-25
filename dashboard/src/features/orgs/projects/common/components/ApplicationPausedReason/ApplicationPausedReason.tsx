import { Alert } from '@/components/ui/v2/Alert';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

interface ApplicationPausedReasonProps {
  freeAndLiveProjectsNumberExceeded?: boolean;
}

export default function ApplicationPausedReason({
  freeAndLiveProjectsNumberExceeded,
}: ApplicationPausedReasonProps) {
  const { org } = useCurrentOrg();

  return (
    <Alert
      severity="warning"
      className="flex flex-col w-full max-w-xs gap-4 p-6 mx-auto text-left"
    >
      {org?.plan?.isFree ? (
        <p>
          Projects under your Personal Organization will stop responding to API
          calls after 7 days of inactivity, so consider transferring the project
          to a <b>Pro Organization</b> to avoid auto-sleep.
        </p>
      ) : (
        <p className="text-center">Your project is Paused.</p>
      )}
      {freeAndLiveProjectsNumberExceeded && (
        <p className="text-center">
          Additionally, only 1 free project can be active at any given time, so
          please pause your current active free project before unpausing
          another.
        </p>
      )}
    </Alert>
  );
}
