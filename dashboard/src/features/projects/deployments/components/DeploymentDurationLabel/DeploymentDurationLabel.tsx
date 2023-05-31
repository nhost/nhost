import { Text } from '@/components/ui/v2/Text';
import { differenceInSeconds, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';

export interface DeploymentDurationLabelProps {
  /**
   * Start date of the deployment.
   */
  startedAt: string;
  /**
   * End date of the deployment.
   */
  endedAt?: string;
}

export default function DeploymentDurationLabel({
  startedAt,
  endedAt,
}: DeploymentDurationLabelProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (!endedAt) {
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    return () => {
      clearInterval(interval);
    };
  }, [endedAt]);

  const totalDurationInSeconds = differenceInSeconds(
    endedAt ? parseISO(endedAt) : currentTime,
    parseISO(startedAt),
  );

  if (totalDurationInSeconds > 1200) {
    return <div>20+m</div>;
  }

  const durationMins = Math.floor(totalDurationInSeconds / 60);
  const durationSecs = totalDurationInSeconds % 60;

  return (
    <Text
      style={{ fontVariantNumeric: 'tabular-nums' }}
      className="self-center font-display text-sm+"
    >
      {Number.isNaN(durationMins) || Number.isNaN(durationSecs) ? (
        <span>0m 0s</span>
      ) : (
        <span>
          {durationMins}m {durationSecs}s
        </span>
      )}
    </Text>
  );
}
