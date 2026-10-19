import type { ReactNode } from 'react';

/**
 * One titled band inside the account card.
 *
 * The account page is a single card and these are its sections, so the heading
 * and the spacing live here rather than in each one. `page.tsx` draws the rule
 * between them with `divide-y`, which is why there is no border in here.
 *
 * The title is a real heading, so the sections can be navigated by one.
 */
export default function AccountSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 px-6 py-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-semibold leading-none">{title}</h2>
        {description ? (
          <div className="text-muted-foreground text-sm">{description}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
