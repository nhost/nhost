import { Settings2 } from 'lucide-react';
import { TimezonePicker } from '@/components/common/TimezonePicker';
import { Button } from '@/components/ui/v3/button';
import { getUTCOffsetInHours } from '@/utils/timezoneUtils';

interface Props {
  dateTime: string;
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
}

function TimezoneSettings({ dateTime, timezone, onTimezoneChange }: Props) {
  const utcOffset = getUTCOffsetInHours(timezone, dateTime, 'OOOO');

  return (
    <div className="flex w-full items-center justify-between">
      <span>Timezone: {utcOffset}</span>
      <TimezonePicker
        dateTime={dateTime}
        selectedTimezone={timezone}
        onTimezoneSelect={(tz) => onTimezoneChange(tz.value)}
        button={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open timezone settings"
            data-testid="timezoneSettingsButton"
          >
            <Settings2 className="h-4 w-4 dark:text-foreground" />
          </Button>
        }
      />
    </div>
  );
}

export default TimezoneSettings;
