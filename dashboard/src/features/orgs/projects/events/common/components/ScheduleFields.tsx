import { getCronScheduleKind } from '@/features/orgs/projects/events/common/components/CronScheduleInput/cron-schedule';

const SCHEDULE_FIELDS = ['Minute', 'Hour', 'Day', 'Month', 'Weekday'];

export default function ScheduleFields({ schedule }: { schedule: string }) {
  const parts = schedule.trim().split(/\s+/);
  if (getCronScheduleKind(schedule) !== 'expression' || parts.length !== 5) {
    return (
      <p className="mt-3 inline-block rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">
        {schedule}
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {parts.map((part, index) => (
        <div
          key={SCHEDULE_FIELDS[index]}
          className="flex min-w-20 flex-col items-center rounded-md border bg-muted/30 px-3 py-2"
        >
          <span className="font-mono font-semibold text-lg">{part}</span>
          <span className="text-muted-foreground text-xs">
            {SCHEDULE_FIELDS[index]}
          </span>
        </div>
      ))}
    </div>
  );
}
