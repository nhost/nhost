import { ApplicationStatus } from '@/types/application';
import Chip from './v2/Chip';

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

function getNormalizedTitle(title: string) {
  if (title === 'Errored') {
    return 'Live';
  }

  if (title === 'Empty') {
    return 'Setting up';
  }

  return title;
}

export default function StateBadge({ title, status }: StateBadgeProps) {
  const normalizedTitle = getNormalizedTitle(title);

  if (
    status === ApplicationStatus.Empty ||
    status === ApplicationStatus.Unpausing
  ) {
    return <Chip size="small" label={normalizedTitle} color="warning" />;
  }

  if (
    status === ApplicationStatus.Errored ||
    status === ApplicationStatus.Live
  ) {
    return <Chip size="small" label={normalizedTitle} color="success" />;
  }

  return <Chip size="small" color="default" label={normalizedTitle} />;
}
