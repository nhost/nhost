import type { ReactNode } from 'react';
import { ButtonWithLoading } from '@/components/ui/v3/button';

interface TrackUntrackSectionProps {
  isTracked: boolean;
  isPending: boolean;
  onTrackToggle: () => void;
  disabled?: boolean;
  trackLabel?: string;
  description?: ReactNode;
}

export default function TrackUntrackSection({
  isTracked,
  isPending,
  onTrackToggle,
  disabled,
  trackLabel,
  description,
}: TrackUntrackSectionProps) {
  return (
    <div className="flex flex-col gap-2 border-b px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${isTracked ? 'bg-primary' : 'bg-amber-500'}`}
          />
          <span className="font-medium text-sm">
            {isTracked ? 'Tracked in GraphQL' : 'Not tracked in GraphQL'}
          </span>
        </div>
        <ButtonWithLoading
          variant="outline"
          size="sm"
          onClick={onTrackToggle}
          loading={isPending}
          disabled={disabled || isPending}
        >
          {isTracked ? 'Untrack' : trackLabel || 'Track'}
        </ButtonWithLoading>
      </div>
      {description}
    </div>
  );
}
