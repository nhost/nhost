import { passwordRequirements } from '@/app/auth/password/requirements';
import { cn } from '@/lib/utils';

/** The rules a new password has to meet, ticked off as it is typed. */
export default function PasswordRequirements({
  id,
  password,
  confirm,
  className,
}: {
  id: string;
  password: string;
  confirm?: string;
  className?: string;
}) {
  return (
    // items-center so each rule centres as a unit, tick and all, under a card
    // whose heading and button are centred too.
    <ul
      id={id}
      className={cn('flex flex-col items-center gap-1 text-sm', className)}
    >
      {passwordRequirements(password, confirm).map((rule) => (
        // A dash while a rule is still open, so the list does not read as a
        // row of failures before anything is typed. Green once it is met.
        <li
          key={rule.label}
          className={cn(
            'flex items-center gap-1.5',
            rule.met ? 'text-success' : 'text-muted-foreground',
          )}
        >
          <span
            aria-hidden="true"
            className="flex w-2.5 justify-center font-bold"
          >
            {rule.met ? (
              '✓'
            ) : (
              <span className="h-0.5 w-2 rounded-full bg-muted-foreground/60" />
            )}
          </span>
          <span>{rule.label}</span>
          {/* The tick is decoration; this is the same state as words. */}
          <span className="sr-only">{rule.met ? 'met' : 'not met'}</span>
        </li>
      ))}
    </ul>
  );
}
