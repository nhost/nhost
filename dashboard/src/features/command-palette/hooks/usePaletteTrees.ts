import { useMemo } from 'react';

import {
  isPageGated,
  type NavGating,
} from '@/components/layout/MainNav/nav-config';
import { isContainer } from '@/features/command-palette/lib/machine';
import { commandPaletteNavTree } from '@/features/command-palette/nav-tree';
import type { CommandNode } from '@/features/command-palette/types';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

// Gates only children, so the root always survives filtering.
const filterNavTree = (node: CommandNode, gating: NavGating): CommandNode => ({
  ...node,
  children: node.children
    ?.filter((child) => !isPageGated(child.gate, gating))
    .map((child) => filterNavTree(child, gating))
    .filter((child) => child.path !== undefined || isContainer(child)),
});

const withoutScopedPages = (tree: CommandNode): CommandNode => ({
  ...tree,
  children: tree.children?.filter(
    (child) => child.scope !== 'project' && child.scope !== 'org',
  ),
});

export function usePaletteTrees() {
  const platformEnabled = useIsPlatform();
  const settingsDisabled = useSettingsDisabled();

  return useMemo(() => {
    const tree = filterNavTree(commandPaletteNavTree, {
      isNotPlatform: !platformEnabled,
      shouldDisableSettings: settingsDisabled,
    });

    // `tree` must stay complete: recents and scope-node clones derive from it.
    return {
      tree,
      displayTree: platformEnabled ? withoutScopedPages(tree) : tree,
    };
  }, [platformEnabled, settingsDisabled]);
}
