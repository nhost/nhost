import type { ReactElement } from 'react';

export type NodeKind = 'page' | 'group' | 'setting' | 'org' | 'project' | 'doc';

export interface CommandNode {
  id: string;
  title: string;
  icon?: ReactElement;
  kind: NodeKind;
  path?: string;
  scope?: 'org' | 'project' | 'external';
  keywords?: string[];
  shortcut?: string;
  hint?: string;
  children?: CommandNode[];
  requiresPlatform?: boolean;
}

export interface ScoredNode {
  node: CommandNode;
  score: number;
  titleRanges: Array<[start: number, end: number]>;
}

export interface RecentEntry {
  nodeId: string;
  title: string;
  path: string;
  accessedAt: number;
  orgSlug?: string;
  appSubdomain?: string;
}
