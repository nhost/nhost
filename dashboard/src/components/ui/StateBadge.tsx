import { ApplicationStatus } from '@/types/application';
import clsx from 'clsx';

export interface StateBadgeProps {
  /**
   * This is the current state of the application.
   */
  status: ApplicationStatus;
  /**
   * The title to show on the application state badge.
   */
  title: string;
}

function classSwitcherByStatus(status: ApplicationStatus) {
  switch (status) {
    case ApplicationStatus.Empty:
      return 'bg-lightOrange text-orange';
    case ApplicationStatus.Provisioning:
      return 'bg-lightOrange text-orange';
    case ApplicationStatus.Live:
      return 'bg-live text-greenDark';
    case ApplicationStatus.Errored:
      return 'bg-live text-greenDark';
    case ApplicationStatus.Paused:
      return 'bg-greyscaleGrey text-greyscaleDark';
    case ApplicationStatus.Unpausing:
      return 'bg-lightOrange text-orange';
    default:
      return 'bg-greyscaleGrey text-greyscaleDark';
  }
}

export default function StateBadge({ title, status }: StateBadgeProps) {
  return (
    <div
      className={clsx(
        'badge flex self-center bg-opacity-20 text-xs font-medium',
        classSwitcherByStatus(status),
      )}
    >
      <span className="font-display text-xs font-medium">
        {title === 'Empty' && 'Setting up'}
        {title === 'Errored' && 'Live'}
        {title !== 'Empty' && title !== 'Errored' && title}
      </span>
    </div>
  );
}
