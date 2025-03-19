import { TimezonePicker } from '@/components/common/TimezonePicker';
import { Button } from '@/components/ui/v3/button';
import { getUTCOffsetInHours, guessTimezone } from '@/utils/timezoneUtils';
import { Settings2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  dateTime: string;
  onTimezoneChange: (timezone: string) => void;
}

function TimezoneSettings({ dateTime, onTimezoneChange }: Props) {
  const [selectedTimezone, setTimezone] = useState<string>(() =>
    guessTimezone(),
  );

  function handleTimezoneSelect(tz: { value: string; label: string }) {
    setTimezone(tz.value);
    onTimezoneChange?.(tz.value);
  }

  const utcOffset = getUTCOffsetInHours(selectedTimezone, dateTime, 'OOOO');

  return (
    <div className="flex w-full items-center justify-between">
      <span>Timezone: {utcOffset}</span>
      <TimezonePicker
        dateTime={dateTime}
        selectedTimezone={selectedTimezone}
        onTimezoneSelect={handleTimezoneSelect}
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
