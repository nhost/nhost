import { alpha, styled } from '@mui/material';
import {
  dayPickerClasses,
  pickersCalendarHeaderClasses,
} from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { pickersDayClasses } from '@mui/x-date-pickers/PickersDay';
import type { StaticDatePickerProps } from '@mui/x-date-pickers/StaticDatePicker';
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker';

export interface DatePickerProps
  extends Omit<
    StaticDatePickerProps<any, Date>,
    'renderInput' | 'componentsProps' | 'renderDay'
  > {
  /**
   * Date value to be displayed in the datepicker.
   * It should be of "yyyy-MM-dd'T'HH:mm" format.
   */
  value: Date;
  /**
   * If true, it will not allow the user to select any date.
   */
  disabled?: boolean;
  /**
   * The lower bound (a day) in the allowed range that can be selected for the date picker.
   */
  minDate?: Date;
  /**
   * The upper bound (a day) in the allowed range that can be selected for the date picker.
   */
  maxDate?: Date;
  /**
   * Function to be called when the user selects a date.
   */
  onChange: (value: Date, keyboardInputValue?: string) => void;
}

const CustomStaticDatePicker = styled(StaticDatePicker)(({ theme }) => ({
  borderRadius: '10px',
  maxWidth: '284px',

  '& .MuiTouchRipple-root': {
    display: 'none',
  },

  [`& .${pickersCalendarHeaderClasses.root}`]: {
    padding: theme.spacing(2, 2),
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: '284px',
  },

  [`& .${pickersCalendarHeaderClasses.label}`]: {
    padding: 0,
    margin: 0,
    fontSize: '0.938rem',
    maxWidth: '284px',
    justifyContent: 'center',
    alignItems: 'center',

    '&:focus': {
      boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`,
    },
  },

  '& .MuiPickersArrowSwitcher-button': {
    color: theme.palette.text.secondary,
    '&:disabled': {
      color: theme.palette.text.disabled,
      borderWidth: 1,
      fontWeight: 400,
      cursor: 'not-allowed',
    },
    '&:hover': {
      backgroundColor: theme.palette.grey[300],
      borderWidth: 1,
    },
    '&:focus': {
      boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`,
    },
  },

  [`& .${pickersCalendarHeaderClasses.switchViewIcon}`]: {
    color: theme.palette.text.secondary,
  },

  '& button': {
    fontSize: '13.5px',
    lineHeight: '1.3rem',
  },

  '& button.Mui-selected': {
    backgroundColor: theme.palette.primary.main,
  },

  [`& .${dayPickerClasses.header}`]: {
    maxWidth: '284px',
    padding: 0,
    margin: 0,
    gap: '3px',
  },

  [`& .${dayPickerClasses.slideTransition}`]: {
    maxHeight: '240px',
  },

  [`& .${dayPickerClasses.weekContainer}`]: {
    padding: 0,
    margin: 0,
    maxWidth: '284px',
    gap: '0px',
  },

  [`& .${dayPickerClasses.weekDayLabel}`]: {
    margin: 0,
    maxWidth: '284px',
  },

  [`& .${pickersDayClasses.root}`]: {
    borderRadius: theme.shape.borderRadius,
    fontWeight: 500,
    color: theme.palette.text.primary,
    backgroundColor: 'transparent',
    margin: theme.spacing(0.1875, 0.1875),
    gap: '3px',

    '&:disabled': {
      color: theme.palette.text.disabled,
      borderWidth: 1,
      fontWeight: 400,
      cursor: 'not-allowed',
      pointerEvents: 'all !important',
    },
    '&:hover': {
      backgroundColor: theme.palette.grey[300],
      borderWidth: 1,
    },

    '&.Mui-selected': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,

      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
  },
}));

function DatePicker({
  onChange,
  disabled,
  minDate,
  maxDate,
  value,
}: DatePickerProps) {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <CustomStaticDatePicker
        disableHighlightToday
        displayStaticWrapperAs="desktop"
        componentsProps={{
          leftArrowButton: {
            disableRipple: true,
          },
          rightArrowButton: {
            disableRipple: true,
          },
        }}
        dayOfWeekFormatter={(day) => day}
        disabled={disabled}
        showDaysOutsideCurrentMonth
        showToolbar={false}
        value={value}
        minDate={minDate}
        maxDate={maxDate}
        onChange={(newValue) => onChange(newValue as Date)}
        renderInput={() => null}
      />
    </LocalizationProvider>
  );
}

export default DatePicker;
