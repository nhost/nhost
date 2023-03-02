// TODO: We should infer the types from GraphQL Codegens and never manually create types like this.
// It's too easy to get types out-of-sync which will generate bugs down the line

import type {
  EnvironmentVariableFragment,
  PermissionVariableFragment,
  ProjectFragment,
  SecretFragment,
} from '@/utils/__generated__/graphql';

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

export type Project = ProjectFragment;

export interface PermissionVariable extends PermissionVariableFragment {
  isSystemVariable?: boolean;
}

export type Role = {
  name: string;
  isSystemRole?: boolean;
};

export type EnvironmentVariable = EnvironmentVariableFragment;
export type Secret = SecretFragment;
