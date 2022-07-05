// * Helpers for casting environment variables

export const castStringEnv = (envVar: string, defaultValue = ''): string => {
  const env = process.env[envVar];
  return env || defaultValue;
};

export const castBooleanEnv = (
  envVar: string,
  defaultValue = false
): boolean => {
  const env = process.env[envVar];
  return env ? env.toLowerCase() === 'true' : defaultValue;
};

export const castIntEnv = (envVar: string, defaultValue: number): number => {
  const env = process.env[envVar];
  return env ? parseInt(env, 10) : defaultValue;
};

export const castStringArrayEnv = (
  envVar: string,
  defaultValue: string[] = []
): string[] => {
  const env = process.env[envVar];
  return env?.length
    ? env.split(',').map((field) => field.trim())
    : defaultValue;
};

export const castObjectEnv = <T extends Record<string, unknown>>(
  envVar: string,
  defaultValue: T = {} as T
): T => {
  const env = process.env[envVar];
  return env ? JSON.parse(env) : defaultValue;
};
