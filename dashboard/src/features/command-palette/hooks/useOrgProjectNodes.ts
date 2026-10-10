import { useMemo } from 'react';

import { buildOrgProjectNodes } from '@/features/command-palette/lib/scopeNodes';
import type { CommandNode } from '@/features/command-palette/types';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { Org } from '@/features/orgs/projects/hooks/useOrgs';

const NO_NODES: CommandNode[] = [];

export function useOrgProjectNodes(
  tree: CommandNode,
  orgs: Org[],
): CommandNode[] {
  const isPlatform = useIsPlatform();

  return useMemo(() => {
    if (!isPlatform) {
      return NO_NODES;
    }

    return buildOrgProjectNodes(orgs, tree);
  }, [isPlatform, orgs, tree]);
}
