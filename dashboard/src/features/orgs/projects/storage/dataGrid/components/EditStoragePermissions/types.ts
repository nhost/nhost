import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';

export type StorageAction = 'download' | 'upload' | 'replace' | 'delete';

export const STORAGE_ACTIONS: StorageAction[] = [
  'upload',
  'download',
  'replace',
  'delete',
];

export const STORAGE_ACTION_TO_DB_ACTION: Record<
  StorageAction,
  DatabaseAction
> = {
  download: 'select',
  upload: 'insert',
  replace: 'update',
  delete: 'delete',
};

export const DB_ACTION_TO_STORAGE_ACTION: Record<
  DatabaseAction,
  StorageAction
> = {
  select: 'download',
  insert: 'upload',
  update: 'replace',
  delete: 'delete',
};

export const STORAGE_ACTION_LABELS: Record<StorageAction, string> = {
  download: 'Download',
  upload: 'Upload',
  replace: 'Replace',
  delete: 'Delete',
};

export const STORAGE_SCHEMA = 'storage';
export const STORAGE_TABLE = 'files';

export const STORAGE_COLUMNS_BY_ACTION: Record<StorageAction, string[]> = {
  download: [
    'id',
    'name',
    'size',
    'bucket_id',
    'etag',
    'created_at',
    'updated_at',
    'is_uploaded',
    'mime_type',
    'uploaded_by_user_id',
    'metadata',
  ],
  upload: ['id', 'bucket_id', 'mime_type', 'name', 'size'],
  replace: [
    'bucket_id',
    'etag',
    'is_uploaded',
    'metadata',
    'mime_type',
    'name',
    'size',
  ],
  delete: [],
};

export interface PermissionPreset {
  id: string;
  label: string;
  group: string;
  createNode: () => RuleNode;
}

export type RowCheckType = 'none' | 'custom';

export interface StoragePermissionEditorFormValues {
  rowCheckType: RowCheckType;
  // biome-ignore lint/suspicious/noExplicitAny: permission filter can be any shape
  filter: Record<string, any> | null;
  prefillUploadedByUserId?: boolean;
}
