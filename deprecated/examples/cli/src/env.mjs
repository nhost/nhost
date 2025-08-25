/**
 * Contains environment variables that are used in the CLI.
 */
export const env = () => ({
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ACCOUNT_EMAIL: process.env.NHOST_ACCOUNT_EMAIL,
  ACCOUNT_PASSWORD: process.env.NHOST_ACCOUNT_PASSWORD,
  ACCOUNT_PAT: process.env.NHOST_ACCOUNT_PAT
})
