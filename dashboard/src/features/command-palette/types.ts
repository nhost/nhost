import type { ReactElement } from 'react';
import type { PageGate } from '@/components/layout/MainNav/nav-config';

export type NodeKind = 'page' | 'group' | 'setting' | 'org' | 'project' | 'doc';

export interface CommandNode {
  id: string;
  title: string;
  icon?: ReactElement;
  kind: NodeKind;
  path?: string;
  scope?: 'org' | 'project' | 'external';
  keywords?: string[];
  hint?: string;
  children?: CommandNode[];
  gate?: PageGate;
  // Search flattening stops here; drilling still descends into children.
  searchBoundary?: boolean;
}

export interface CommandNodeMetadata {
  // Generic tree node behind a runtime clone; drives navigation and recents.
  originalNode?: CommandNode;
  orgSlug?: string;
  appSubdomain?: string;
}

export type RuntimeCommandNode = CommandNode & {
  commandPalette?: CommandNodeMetadata;
};

export interface PaletteOrg {
  slug: string;
  name: string;
  apps: Array<{ name: string; subdomain: string }>;
}

export type TitleRange = [start: number, end: number];

export interface ScoredNode {
  node: CommandNode;
  score: number;
  titleRanges: TitleRange[];
}

export interface RecentEntry {
  nodeId: string;
  title: string;
  path: string;
  accessedAt: number;
  orgSlug?: string;
  appSubdomain?: string;
}
