import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * One titled band inside the account card.
 *
 * The account page is a single card and these are its sections, so the heading
 * and the spacing live here rather than in each one. `page.tsx` draws the rule
 * between them with `divide-y`, which is why there is no border in here.
 *
 * The title is a real heading, so the sections can be navigated by one.
 * `action` is for a control that belongs to the section as a whole rather
 * than to anything in it: it sits beside the heading instead of under the
 * description, where it would read as the next step after it.
 */
export default function AccountSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="font-semibold leading-none">{title}</h2>
          {description ? (
            <div className="text-muted-foreground text-sm">{description}</div>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The small caps above a field or a group of them.
 *
 * Quieter and smaller than the section heading, so a label can name what sits
 * under it without competing with the title of the section it is in.
 */
export function FieldLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'font-medium text-muted-foreground text-xs uppercase tracking-wider',
        className,
      )}
    >
      {children}
    </span>
  );
}
