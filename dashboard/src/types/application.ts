// TODO: We should infer the types from GraphQL Codegens and never manually create types like this.
// It's too easy to get types out-of-sync which will generate bugs down the line

import type { GetEnvironmentVariablesQuery } from '@/utils/__generated__/graphql';

/**
 * The current state of the application.
 */
export enum ApplicationStatus {
  Empty = 0,
  Provisioning = 1,
  Pausing = 2,
  Unpausing = 3,
  Deleting = 4,
  Live = 5,
  Paused = 6,
  Deleted = 7,
  Errored = 8,
  Updating = 9,
  Restoring = 10,
  Migrating = 11,
}

/**
 * Desired state of an application, an update of the desired state will always come before a change
 * in the current state (except when the current applications state is 'Updating').
 */
export type DesiredState =
  | ApplicationStatus.Live
  | ApplicationStatus.Paused
  | ApplicationStatus.Migrating;

export type ApplicationState = {
  __typeName?: string;
  id: string;
  appId: string;
  message?: string | null;
  stateId: ApplicationStatus;
  createdAt: string;
};

export type Deployment = {
  id: string;
  commitSHA: string;
  commitUserName: string;
  deploymentStartedAt: string;
  deploymentEndedAt: string;
  commitUserAvatarUrl: string;
  deploymentStatus: string;
  commitMessage?: string;
};

export type FeatureFlag = {
  description: string;
  id: string;
  name: string;
  value: string;
};

export type Application = {
  id: string;
  slug: string;
  name: string;
  appStates: ApplicationState[];
  hasuraGraphqlAdminSecret: string;
  subdomain: string;
  isProvisioned: boolean;
  githubRepository?: { fullName: string } | null;
  storageSize?: string;
  repositoryProductionBranch?: string;
  plan?: { name: string; id: string; isFree?: boolean };
  createdAt: string;
  region: { awsName: string; countryCode: string; city: string; id: string };
  users?: number;
  deployments: Deployment[];
  desiredState: DesiredState;
  nhostBaseFolder?: string;
  featureFlags: FeatureFlag[];
  providersUpdated: boolean;
};

export type CustomClaim = {
  key: string;
  value: string;
  isSystemClaim?: boolean;
};

export type Role = {
  name: string;
  isSystemRole?: boolean;
};

export type EnvironmentVariable =
  GetEnvironmentVariablesQuery['environmentVariables'][number];
