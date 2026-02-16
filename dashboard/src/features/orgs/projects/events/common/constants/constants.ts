export const DEFAULT_NUM_RETRIES = 0;

export const DEFAULT_RETRY_INTERVAL_SECONDS = 10;

export const DEFAULT_RETRY_TIMEOUT_SECONDS = 60;

export const DEFAULT_TOLERANCE_SECONDS = 21600;

export const requestTransformMethods = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

export const requestOptionsTransformQueryParamsTypeOptions = [
  'Key Value',
  'URL string template',
] as const;
