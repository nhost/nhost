export const WORKSPACE_CONTAINS_APPLICATIONS =
  'constraint "apps_workspace_id_fkey" on table "apps"';
export const NOT_ALPHANUMERIC = /[^a-z0-9]/gi;
export const UNIQUENESS_ERROR = 'Uniqueness';
export const REMOVE_APPLICATIONS_ERROR_MESSAGE =
  'You need to remove your current projects on this workspace first.';
export const CONSTRAINT_ERROR =
  'You need to remove your current projects on this workspace first.';
export const WORKSPACE_OWNERS_ERROR_MESSAGE =
  'Only owners of workspaces can create projects.';
export const INSUFFICIENT_PERMISSIONS =
  'check constraint of an insert/update permission has failed';
export const INSUFFICIENT_PERMISSIONS_MESSAGE =
  'You have insufficient permisions to perform this action. Please contact your workspace owner.';

/**
 * A list of database schemas that are not editable.
 */
export const READ_ONLY_SCHEMAS = ['auth', 'storage'];

/**
 * Key used to store the color preference in local storage.
 */
export const COLOR_PREFERENCE_STORAGE_KEY = 'nhost-color-preference';
