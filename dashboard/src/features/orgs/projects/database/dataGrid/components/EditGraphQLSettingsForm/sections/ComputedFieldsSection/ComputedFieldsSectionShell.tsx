import type { PropsWithChildren, ReactNode } from 'react';

export interface ComputedFieldsSectionShellProps {
  action?: ReactNode;
}

export default function ComputedFieldsSectionShell({
  action,
  children,
}: PropsWithChildren<ComputedFieldsSectionShellProps>) {
  return (
    <div className="flex flex-col gap-4 px-6 pb-4">
      <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
        <div className="grid grid-flow-col place-content-between items-center gap-3 px-4">
          <div className="grid grid-flow-row gap-1">
            <h2 className="font-semibold text-lg">Computed Fields</h2>
            <p className="text-muted-foreground text-sm+">
              Expose Postgres function results as virtual columns in your
              GraphQL API.
            </p>
          </div>
          {action ? <div className="justify-self-end">{action}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
