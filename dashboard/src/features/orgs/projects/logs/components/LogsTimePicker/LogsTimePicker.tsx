import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { useDropdown } from '@/components/ui/v2/Dropdown';
import type { InputProps } from '@/components/ui/v2/Input';
import { Input } from '@/components/ui/v2/Input';
import { format, set } from 'date-fns';
import type { ChangeEvent } from 'react';

export interface LogTimePickerProps extends InputProps {
  /**
   * The upper bound (a day) in the allowed range that can be selected for the date picker.
   */
  maxDate?: Date;
}

const TIMEPICKER_STEP = 1;

function LogsTimePicker({
  selectedDate,
  setSelectedDate,
  onChange,
  maxDate,
}: any) {
  const { handleClose } = useDropdown();

  function handleCancel() {
    handleClose();
  }

  function handleApply() {
    onChange(selectedDate);
    handleClose();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const [hours, minutes, seconds] = event.target.value?.split(':') || [];

    const hoursNumber = parseInt(hours || '0', 10);
    const minutesNumber = parseInt(minutes || '0', 10);
    const secondsNumber = parseInt(seconds || '0', 10);

    const newDate = set(new Date(selectedDate), {
      hours: hoursNumber,
      minutes: minutesNumber,
      seconds: secondsNumber,
    });

    // if the new date is a date surpassing the the max allowed date (that is, the `toDate`)
    // we don't allow the user to select set it.
    if (newDate > maxDate) {
      return;
    }

    setSelectedDate(newDate);
  }

  return (
    <div className="mx-auto grid grid-flow-row items-center self-center">
      <Box className="border px-4 py-2">
        <Input
          value={format(selectedDate, 'HH:mm:ss')}
          style={{ width: '135px' }}
          id="time-picker"
          slotProps={{
            formControl: { className: 'grid grid-flow-col gap-x-3' },
            label: { sx: { fontSize: '14px' } },
          }}
          onChange={handleChange}
          type="time"
          label="Select Time"
          sx={{
            '& [type=time]': {
              lineHeight: '1.375rem',
              fontWeight: 500,
              color: 'text.primary',
              backgroundColor: 'transparent',
              padding: (theme) => theme.spacing(0.75, 3.75),
            },
          }}
          fullWidth
          inputProps={{
            step: TIMEPICKER_STEP,
          }}
        />
      </Box>
      <Box className="grid grid-flow-col justify-end gap-x-4 px-4 py-2">
        <Button variant="outlined" color="secondary" onClick={handleCancel}>
          Cancel
        </Button>

        <Button variant="contained" color="primary" onClick={handleApply}>
          Set
        </Button>
      </Box>
    </div>
  );
}

export default LogsTimePicker;
