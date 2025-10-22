export const DEFAULT_RETRY_TIMEOUT_SECONDS = 60;

export const TRIGGER_OPERATIONS = [
  'insert',
  'update',
  'delete',
  'manual',
] as const;

export const UPDATE_TRIGGER_ON = ['all', 'choose'] as const;
