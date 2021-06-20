// * Helpers for casting environment variables
export const castBooleanEnv = (envVar: string, defaultValue = false): boolean =>
  process.env[envVar] ? process.env[envVar]?.toLowerCase() === 'true' : defaultValue
export const castIntEnv = (envVar: string, defaultValue: number): number =>
  process.env[envVar] ? parseInt(process.env[envVar] as string, 10) : defaultValue
export const castStringArrayEnv = (envVar: string, defaultValue: string[] = []): string[] =>
  process.env[envVar]?.length
    ? (process.env[envVar] as string).split(',').map((field) => field.trim())
    : defaultValue
