import type { WorkspaceMembers } from '@/utils/__generated__/graphql';
import type { Application } from './application';

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  creatorUserId?: string;
  members: WorkspaceMembers[];
  applications: Application[];
  default?: boolean;
};
