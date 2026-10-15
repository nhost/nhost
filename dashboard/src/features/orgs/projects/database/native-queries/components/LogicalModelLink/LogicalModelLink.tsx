import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export interface LogicalModelLinkProps {
  /** The logical model's name. */
  name: string;
  className?: string;
  children: ReactNode;
}

/** Links to a logical model of the current project's default data source. */
export default function LogicalModelLink({
  name,
  className,
  children,
}: LogicalModelLinkProps) {
  return (
    <Link
      from="/orgs/$orgSlug/projects/$appSubdomain"
      to="/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug/models/$modelSlug"
      params={(prev) => ({
        ...prev,
        dataSourceSlug: 'default',
        modelSlug: name,
      })}
      className={className}
    >
      {children}
    </Link>
  );
}
