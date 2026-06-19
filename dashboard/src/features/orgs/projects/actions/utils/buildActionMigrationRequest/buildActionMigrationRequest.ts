import type {
  CreateActionPermissionStep,
  CreateActionStep,
  DropActionOperation,
  DropActionPermissionStep,
  MigrationRequest,
  MigrationStep,
  SetCustomTypesStep,
  UpdateActionStep,
} from '@/utils/hasura-api/generated/schemas';

export type ActionMigrationStep =
  | SetCustomTypesStep
  | CreateActionStep
  | UpdateActionStep
  | DropActionOperation
  | CreateActionPermissionStep
  | DropActionPermissionStep;

export interface ActionMigrationSteps {
  up: ActionMigrationStep[];
  down: ActionMigrationStep[];
}

export default function buildActionMigrationRequest(
  name: string,
  { up, down }: ActionMigrationSteps,
): MigrationRequest {
  return {
    name,
    // The generated MigrationStep union omits action operations, but the
    // migrate API accepts them, so the assembled steps are cast.
    up: up as unknown as MigrationStep[],
    down: down as unknown as MigrationStep[],
    datasource: 'default',
    skip_execution: false,
  };
}
