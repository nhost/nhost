import { memo, useMemo } from 'react';
import { VirtualizedCombobox } from '@/components/common/VirtualizedCombobox';
import { createTimezoneOptions } from '@/utils/timezoneUtils';

interface Props {
  selectedTimezone: string;
  onTimezoneSelect: (timezone: { value: string; label: string }) => void;
  button?: React.JSX.Element;
  dateTime: string;
}

function getOrderedTimezones(dateTime: string, selectedTimezone: string) {
  const [utcTimezone, browserTimezone, ...timezones] =
    createTimezoneOptions(dateTime);
  let orderedTimezones = [...timezones];
  if (
    selectedTimezone !== browserTimezone.value &&
    selectedTimezone !== 'UTC'
  ) {
    const selectedTimezoneOption = timezones.find(
      (tz) => tz.value === selectedTimezone,
    )!;
    orderedTimezones = [
      selectedTimezoneOption,
      ...timezones.filter((tz) => tz.value !== selectedTimezone),
    ];
  }

  return [utcTimezone, browserTimezone, ...orderedTimezones];
}

function TimezonePicker({
  selectedTimezone,
  onTimezoneSelect,
  button,
  dateTime,
}: Props) {
  const timezoneOptions = useMemo(
    () => getOrderedTimezones(dateTime, selectedTimezone),
    [dateTime, selectedTimezone],
  );

  return (
    <VirtualizedCombobox
      options={timezoneOptions}
      selectedOption={selectedTimezone}
      onSelectOption={onTimezoneSelect}
      searchPlaceholder="Search timezones..."
      button={button}
      side="right"
      width="370px"
    />
  );
}

export default memo(TimezonePicker);
