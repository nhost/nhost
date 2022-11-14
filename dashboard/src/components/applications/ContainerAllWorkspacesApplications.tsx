import type { PropsWithChildren } from 'react';

export function ContainerAllWorkspacesApplications({
  children,
}: PropsWithChildren<unknown>) {
  return (
    <div className="grid grid-flow-row grid-rows-1 gap-2 divide-y-1 divide-divide border-t border-b">
      {children}
    </div>
  );
}

export default ContainerAllWorkspacesApplications;
