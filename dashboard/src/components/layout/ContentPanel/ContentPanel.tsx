import type { PropsWithChildren } from 'react';

/**
 * The framed panel a page sits in below an area's route tabs. Pages that
 * bring their own sidebar (backups, settings) don't use it.
 */
export default function ContentPanel({ children }: PropsWithChildren) {
  return (
    <div className="mx-4 mb-4 min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
      {children}
    </div>
  );
}
