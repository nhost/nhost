import type { GraphQLPlaygroundSelection } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';

/** What each run sends: used by the copy menu. */
export interface PlaygroundRequest {
  endpoint: string;
  adminSecret: string;
  selection: GraphQLPlaygroundSelection;
  headersTabOverrides: Record<string, unknown>;
}

/** The tabs of the response pane. */
export type PlaygroundPanelTab = 'response' | 'history' | 'docs';
