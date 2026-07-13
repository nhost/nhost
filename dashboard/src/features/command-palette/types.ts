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
