import { VirtualizedCombobox } from '@/components/common/VirtualizedCombobox';
import { createTimezoneOptions } from '@/utils/timezoneUtils';
import { memo, useMemo } from 'react';

interface Props {
  selectedTimezone: string;
  onTimezoneSelect: (timezone: { value: string; label: string }) => void;
  button?: React.JSX.Element;
  dateTime: string;
}

function TimezonePicker({
  selectedTimezone,
  onTimezoneSelect,
  button,
  dateTime,
}: Props) {
  const timezoneOptions = useMemo(
    () => createTimezoneOptions(dateTime),
    [dateTime],
  );
  return (
    <VirtualizedCombobox
      options={timezoneOptions}
      selectedOption={selectedTimezone}
      onSelectOption={onTimezoneSelect}
      searchPlaceholder="Search timezones..."
      button={button}
      side="right"
    />
  );
}

export default memo(TimezonePicker);
