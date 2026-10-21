import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Opens and closes its content by sliding it, eased in and out.
 *
 * Height cannot transition to `auto`, but a grid row can go from `0fr` to
 * `1fr`, which is the content's own height, so nothing here measures it. The
 * content stays mounted while closed, which is what lets it slide shut rather
 * than vanish; `inert` keeps it out of the tab order and the accessibility
 * tree meanwhile.
 *
 * Anything inside with a focus ring wants some padding around it, since the
 * inner box clips to the height the row is at.
 */
export default function Collapse({
  open,
  id,
  children,
}: {
  open: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      inert={!open}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
