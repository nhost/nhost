import { XIcon } from 'lucide-react';
import { Alert } from '@/components/ui/v3/alert';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { ApplicationStatus } from '@/types/application';

export default function DatabaseMigrateWarning() {
  const { state } = useAppState();

  if (
    state === ApplicationStatus.Paused ||
    state === ApplicationStatus.Pausing
  ) {
    return null;
  }

  return (
    <Alert variant="destructive" className="flex flex-col gap-3 text-left">
      <p className="flex items-center gap-1 font-semibold">
        <XIcon className="h-4 w-4" /> Error: Database major version upgrade not
        possible
      </p>
      <p>
        Your project isn&apos;t currently in a healthy state. Please, review
        before proceeding with a major version upgrade.
      </p>
    </Alert>
  );
}
