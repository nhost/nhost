import { Info } from 'lucide-react';
import { forwardRef, type SyntheticEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Input, type InputProps } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  getCronFieldAtCursor,
  getCronScheduleKind,
} from '@/features/orgs/projects/events/sql-jobs/cron-schedule';
import { cn } from '@/lib/utils';

const CRON_FIELDS = [
  { label: 'Minute', range: '0–59' },
  { label: 'Hour', range: '0–23' },
  { label: 'Day', range: '1–31' },
  { label: 'Month', range: '1–12' },
  { label: 'Weekday', range: '0–7' },
];

const CRON_EXAMPLES = [
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Daily at 05:00', value: '0 5 * * *' },
  { label: 'Weekdays at 22:00', value: '0 22 * * 1-5' },
  { label: 'Every 10 seconds', value: '10 seconds' },
];

interface SqlJobScheduleInputProps
  extends Pick<
    InputProps,
    'id' | 'name' | 'aria-describedby' | 'aria-invalid'
  > {
  value: string;
  onChange?: (value: string) => void;
  onBlur?: VoidFunction;
  timezone: string;
  readOnly?: boolean;
  disabled?: boolean;
}

const SqlJobScheduleInput = forwardRef<
  HTMLInputElement,
  SqlJobScheduleInputProps
>(
  (
    {
      value,
      onChange,
      onBlur,
      timezone,
      readOnly = false,
      disabled = false,
      id,
      name,
      'aria-describedby': describedBy,
      'aria-invalid': invalid,
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [cursor, setCursor] = useState<number | null>(null);

    function updateCursor(event: SyntheticEvent<HTMLInputElement>) {
      setCursor(event.currentTarget.selectionStart);
    }

    const activeField = getCronFieldAtCursor(value, cursor);
    const kind = getCronScheduleKind(value);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor={inputId}>Schedule</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="subtle"
                size="icon-xs"
                aria-label="Cron schedule help"
                disabled={disabled}
              >
                <Info aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              aria-label="Cron schedule help"
              className="max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[min(28rem,calc(100vw_-_2rem))] space-y-4 overflow-y-auto text-sm"
              onEscapeKeyDown={(event) => event.stopPropagation()}
            >
              <div className="space-y-2">
                <h3 className="font-semibold">Cron syntax</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  <dt className="font-mono">*</dt>
                  <dd>Any value in this field.</dd>
                  <dt className="font-mono">,</dt>
                  <dd>
                    A list: <code>1,3,5</code>.
                  </dd>
                  <dt className="font-mono">-</dt>
                  <dd>
                    An inclusive range: <code>1-5</code>.
                  </dd>
                  <dt className="font-mono">/</dt>
                  <dd>
                    A step over a wildcard or range: <code>*/15</code> or{' '}
                    <code>1-23/2</code>.
                  </dd>
                  <dt className="font-mono">$</dt>
                  <dd>The last day of the month, in the Day field only.</dd>
                </dl>
                <p className="text-muted-foreground">
                  Months also accept JAN–DEC; weekdays accept SUN–SAT. Sunday is
                  0 or 7. If neither Day nor Weekday starts with *, a match in
                  either is enough.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Shortcuts</h3>
                <ul className="space-y-1">
                  <li>
                    <code>@hourly</code> — at minute 0 of every hour.
                  </li>
                  <li>
                    <code>@daily</code>, <code>@midnight</code> — daily at
                    00:00.
                  </li>
                  <li>
                    <code>@weekly</code> — Sunday at 00:00.
                  </li>
                  <li>
                    <code>@monthly</code> — the first day of each month at
                    00:00.
                  </li>
                  <li>
                    <code>@yearly</code>, <code>@annually</code> — January 1 at
                    00:00.
                  </li>
                  <li>
                    <code>@reboot</code>, <code>@restart</code> — once when the
                    scheduler starts.
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Seconds-based intervals</h3>
                <p>
                  Use <code>1 second</code> through <code>59 seconds</code>,
                  such as <code>10 seconds</code>. An interval replaces the five
                  cron fields; do not combine them.
                </p>
              </div>
              <p className="text-muted-foreground">
                Calendar schedules use {timezone}, not your browser's timezone.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <Input
          ref={ref}
          id={inputId}
          name={name}
          value={value}
          readOnly={readOnly}
          aria-invalid={invalid}
          aria-describedby={[describedBy, `${inputId}-description`]
            .filter(Boolean)
            .join(' ')}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="0 22 * * 1-5"
          className="h-12 text-center font-mono text-lg tracking-wider md:text-lg"
          onFocus={updateCursor}
          onSelect={updateCursor}
          onClick={updateCursor}
          onKeyUp={updateCursor}
          onChange={(event) => {
            onChange?.(event.target.value);
            updateCursor(event);
          }}
          onBlur={() => {
            onBlur?.();
            setCursor(null);
          }}
        />
        <div className="grid grid-cols-5 gap-1">
          {CRON_FIELDS.map(({ label, range }, index) => (
            <div
              key={label}
              className={cn(
                'rounded-md border border-transparent py-2 text-center transition-colors',
                activeField === index
                  ? 'border-primary/20 bg-primary/10 text-primary'
                  : 'text-muted-foreground',
              )}
            >
              <span
                className="block font-medium text-xs"
                aria-current={activeField === index ? 'true' : undefined}
              >
                {label}
              </span>
              <span className="block text-[11px]">{range}</span>
            </div>
          ))}
        </div>
        {kind !== 'expression' && (
          <p className="text-muted-foreground text-xs">
            {kind === 'shortcut'
              ? 'This shortcut replaces all five cron fields.'
              : 'This seconds-based interval replaces all five cron fields.'}
          </p>
        )}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">Examples</span>
            {CRON_EXAMPLES.map(({ label, value: example }) => (
              <Button
                key={example}
                type="button"
                variant="outline"
                size="xs"
                disabled={disabled}
                onClick={() => {
                  onChange?.(example);
                  setCursor(null);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
        <p
          id={`${inputId}-description`}
          className="text-muted-foreground text-sm"
        >
          Schedules use {timezone}.
          {!readOnly &&
            ' Enter five cron fields, an @shortcut, or a 1–59 second interval.'}
        </p>
      </div>
    );
  },
);
SqlJobScheduleInput.displayName = 'SqlJobScheduleInput';

export default SqlJobScheduleInput;
