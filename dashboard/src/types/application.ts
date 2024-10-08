import type {
  AppStateHistoryFragment,
  BackupFragment,
  DeploymentRowFragment,
  EnvironmentVariableFragment,
  GetOrganizationQuery,
  GetProjectQuery,
  PermissionVariableFragment,
  SecretFragment,
  WorkspaceFragment,
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

export type ApplicationState = AppStateHistoryFragment;
export type Deployment = DeploymentRowFragment;
export type Workspace = WorkspaceFragment;
export type Organization = GetOrganizationQuery['organizations'][0];
// export type Project = ProjectFragment;
export type Project = GetProjectQuery['apps'][0];
export type Backup = BackupFragment;

export interface PermissionVariable extends PermissionVariableFragment {
  isSystemVariable?: boolean;
}

export type Role = {
  name: string;
  isSystemRole?: boolean;
};

export type EnvironmentVariable = EnvironmentVariableFragment;
export type Secret = SecretFragment;
