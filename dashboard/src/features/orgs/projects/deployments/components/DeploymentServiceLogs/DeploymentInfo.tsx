import { format, parseISO } from 'date-fns';
import { CalendarClock, PlayIcon } from 'lucide-react';

interface DeploymentInfoProps {
  from: string;
  to: string | null;
}

function DeploymentInfo({ from, to }: DeploymentInfoProps) {
  const deploymentInProgress = to === null;
  const startedAt = format(parseISO(from), 'HH:mm:ss');
  const endedAt = deploymentInProgress
    ? null
    : format(parseISO(to), 'HH:mm:ss');

  return (
    <div className="pt-3">
      {deploymentInProgress ? (
        <p className="inline-flex items-center justify-center gap-3">
          <span className="flex items-center justify-center gap-2">
            <PlayIcon size={14} />
            Deployment in progress
          </span>{' '}
          <span>•</span> <span>Started at: {startedAt}</span>
        </p>
      ) : (
        <div className="inline-flex items-center justify-center gap-3">
          <CalendarClock size={16} /> <span>Showing logs from:</span>{' '}
          <span>
            {startedAt} - {endedAt}
          </span>
        </div>
      )}
    </div>
  );
}

export default DeploymentInfo;
