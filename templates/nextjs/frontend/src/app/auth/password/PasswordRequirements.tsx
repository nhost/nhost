import { passwordRequirements } from '@/app/auth/password/requirements';

/**
 * The rules a new password has to meet, ticked off as it is typed.
 *
 * Every form that sets a password shows this, so what is asked for is the
 * same wherever you arrive from. The fields point at it with
 * `aria-describedby`, which is what reads the list out on focus; the ticks
 * themselves are not announced as they change, since a live region firing on
 * every keystroke is worse than silence.
 */
export default function PasswordRequirements({
  id,
  password,
  confirm,
}: {
  id: string;
  password: string;
  confirm?: string;
}) {
  return (
    <ul id={id} className="flex flex-col gap-1 text-sm">
      {passwordRequirements(password, confirm).map((rule) => (
        <li key={rule.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={
              rule.met
                ? 'w-3 text-center text-foreground'
                : 'w-3 text-center text-muted-foreground'
            }
          >
            {rule.met ? '✓' : '○'}
          </span>
          <span
            className={rule.met ? 'text-foreground' : 'text-muted-foreground'}
          >
            {rule.label}
          </span>
          {/* The tick is decoration; this is the same state as words. */}
          <span className="sr-only">{rule.met ? 'met' : 'not met'}</span>
        </li>
      ))}
    </ul>
  );
}
