// * Helpers for casting environment variables

export const castStringEnv = (envVar: string, defaultValue = ''): string => {
  return process.env[envVar] ? (process.env[envVar] as string) : defaultValue;
};

export const castBooleanEnv = (
  envVar: string,
  defaultValue = false
): boolean => {
  return process.env[envVar]
    ? process.env[envVar]?.toLowerCase() === 'true'
    : defaultValue;
};

export const castIntEnv = (envVar: string, defaultValue: number): number => {
  return process.env[envVar]
    ? parseInt(process.env[envVar] as string, 10)
    : defaultValue;
};

export const castStringArrayEnv = (
  envVar: string,
  defaultValue: string[] = []
): string[] => {
  return process.env[envVar]?.length
    ? (process.env[envVar] as string).split(',').map((field) => field.trim())
    : defaultValue;
};

export const castObjectEnv = <T extends Record<string, unknown>>(
  envVar: string,
  defaultValue: T = {} as T
): T => {
  const env = process.env[envVar];
  if (env) {
    return JSON.parse(env);
  } else return defaultValue;
};
