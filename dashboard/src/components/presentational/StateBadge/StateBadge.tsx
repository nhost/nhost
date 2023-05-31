import { Chip } from '@/components/ui/v2/Chip';
import { ApplicationStatus } from '@/types/application';

export interface StateBadgeProps {
  /**
   * This is the current state of the application.
   */
  state: ApplicationStatus;
  /**
   * This is the desired state of the application.
   */
  desiredState: ApplicationStatus;
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

export default function StateBadge({
  title,
  state,
  desiredState,
}: StateBadgeProps) {
  if (
    desiredState === ApplicationStatus.Paused &&
    state === ApplicationStatus.Live
  ) {
    return <Chip size="small" color="default" label="Pausing" />;
  }

  const normalizedTitle = getNormalizedTitle(title);

  if (
    state === ApplicationStatus.Empty ||
    state === ApplicationStatus.Unpausing ||
    state === ApplicationStatus.Updating
  ) {
    return <Chip size="small" label={normalizedTitle} color="warning" />;
  }

  if (state === ApplicationStatus.Errored || state === ApplicationStatus.Live) {
    return <Chip size="small" label={normalizedTitle} color="success" />;
  }

  return <Chip size="small" color="default" label={normalizedTitle} />;
}
