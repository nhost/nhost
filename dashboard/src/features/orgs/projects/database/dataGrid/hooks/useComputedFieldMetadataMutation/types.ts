import type {
  AddComputedFieldArgs,
  ComputedFieldItem,
  DropComputedFieldArgs,
} from '@/utils/hasura-api/generated/schemas';

export type ComputedFieldMutationType = 'add' | 'edit' | 'delete';

export interface ComputedFieldMutationVariablesMap {
  add: { args: AddComputedFieldArgs };
  edit: { args: AddComputedFieldArgs; original: ComputedFieldItem };
  delete: { args: DropComputedFieldArgs; original: ComputedFieldItem };
}

export type ComputedFieldMutationVariables<
  T extends ComputedFieldMutationType,
> = ComputedFieldMutationVariablesMap[T];
