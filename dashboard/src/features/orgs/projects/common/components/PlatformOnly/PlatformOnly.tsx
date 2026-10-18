import type { ReactNode } from 'react';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

export interface PlatformOnlyProps {
  children: ReactNode;
}

/**
 * Renders its children on the Nhost platform only, and nothing in CLI or
 * self-hosted mode. The children are not mounted there, so their hooks,
 * queries and effects do not run.
 */
export default function PlatformOnly({ children }: PlatformOnlyProps) {
  const isPlatform = useIsPlatform();

  if (!isPlatform) {
    return null;
  }

  return children;
}
