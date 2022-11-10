import type { ReactNode } from 'react';

interface ContainerIndexApplicationsProps {
  children?: ReactNode | ReactNode[];
}

export function ContainerIndexApplications({
  children,
}: ContainerIndexApplicationsProps) {
  return <div className="flex flex-col font-display md:w-app">{children}</div>;
}

export default ContainerIndexApplications;
