import type {
  CreateActionPermissionStep,
  CreateActionStep,
  DropActionOperation,
  DropActionPermissionStep,
  MigrationRequest,
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
    up,
    down,
    datasource: 'default',
    skip_execution: false,
  };
}
