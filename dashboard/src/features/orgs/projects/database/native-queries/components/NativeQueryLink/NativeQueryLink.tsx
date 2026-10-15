import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export interface NativeQueryLinkProps {
  /** The native query's root field name. */
  name: string;
  className?: string;
  children: ReactNode;
}

/** Links to a native query of the current project's default data source. */
export default function NativeQueryLink({
  name,
  className,
  children,
}: NativeQueryLinkProps) {
  return (
    <Link
      from="/orgs/$orgSlug/projects/$appSubdomain"
      to="/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug/queries/$querySlug"
      params={(prev) => ({
        ...prev,
        dataSourceSlug: 'default',
        querySlug: name,
      })}
      className={className}
    >
      {children}
    </Link>
  );
}
