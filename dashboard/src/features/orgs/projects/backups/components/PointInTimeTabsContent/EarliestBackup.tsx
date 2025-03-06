import { TimezonePicker } from '@/components/common/TimezonePicker';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { getDateTimeStringWithUTCOffset } from '@/features/orgs/projects/backups/utils/timezone-utils';
import dayjs from '@/lib/dayjs';
import { isEmptyValue } from '@/lib/utils';
import { useState } from 'react';

interface Props {
  dateTime: string;
  loading: boolean;
}

function EarliestBackupDateTime({ dateTime }: Pick<Props, 'dateTime'>) {
  const [selectedTimezone, setTimezone] = useState<string>(() =>
    dayjs.tz.guess(),
  );
  function handleSelect(tz: { value: string; label: string }) {
    setTimezone(tz.value);
  }
  return (
    <p className="flex items-center gap-2 text-[1.125rem]">
      {getDateTimeStringWithUTCOffset(dateTime, selectedTimezone)}
      <TimezonePicker
        dateTime={dateTime}
        selectedTimezone={selectedTimezone}
        onTimezoneSelect={handleSelect}
        button={
          <Button className="h-auto p-0" variant="link">
            Change timezone
          </Button>
        }
      />
    </p>
  );
}

function EarliestBackup({ dateTime, loading }: Props) {
  if (loading) {
    return (
      <div className="flex h-[27px] max-w-fit">
        <Spinner size="small" />
      </div>
    );
  }
  const hasNoPiTRBackups = !loading && isEmptyValue(dateTime);
  if (hasNoPiTRBackups) {
    return <p className="text-[1.125rem]">Project has no backups yet.</p>;
  }
  return <EarliestBackupDateTime dateTime={dateTime} />;
}

export default EarliestBackup;
