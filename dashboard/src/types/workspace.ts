import type { WorkspaceMembers } from '@/utils/__generated__/graphql';
import type { Project } from './application';

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  creatorUserId?: string;
  members: WorkspaceMembers[];
  applications: Project[];
  default?: boolean;
};
