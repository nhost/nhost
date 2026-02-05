import { format, isBefore, startOfDay } from 'date-fns-v4';
import { Controller, useFormContext } from 'react-hook-form';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import { FormItem, FormLabel, FormMessage } from '@/components/ui/v3/form';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import type { CreateOneOffFormValues } from '@/features/orgs/projects/events/one-offs/components/CreateOneOffForm';

export default function ScheduleAtTimePicker() {
  const form = useFormContext<CreateOneOffFormValues>();

  return (
    <Controller
      control={form.control}
      name="scheduleAt"
      render={({ field, fieldState }) => (
        <FormItem className="max-w-lg">
          <FormLabel>
            <div className="flex flex-row items-center gap-2">
              Schedule At
              <InfoTooltip>
                The time that this event must be delivered
              </InfoTooltip>
            </div>
          </FormLabel>
          <DateTimePicker
            dateTime={field.value}
            onDateTimeChange={(newDateTime) => {
              field.onChange(newDateTime);
            }}
            withTimezone
            formatDateFn={(date) =>
              format(date, 'dd MMM yyyy, HH:mm:ss (OOOO)').replace('GMT', 'UTC')
            }
            isCalendarDayDisabled={(date) =>
              isBefore(startOfDay(date), startOfDay(new Date()))
            }
            validateDateFn={(date) => {
              if (isBefore(date, new Date())) {
                return 'Schedule time must be in the future';
              }
              return '';
            }}
          />
          {fieldState.error && (
            <FormMessage>{fieldState.error.message}</FormMessage>
          )}
        </FormItem>
      )}
    />
  );
}
