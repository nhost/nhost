/**
 * Contains environment variables that are used in the CLI.
 */
export const env = () => ({
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  SERVICE_ACCOUNT_EMAIL: process.env.NHOST_SERVICE_ACCOUNT_EMAIL,
  SERVICE_ACCOUNT_PASSWORD: process.env.NHOST_SERVICE_ACCOUNT_PASSWORD,
  SERVICE_ACCOUNT_PAT: process.env.NHOST_SERVICE_ACCOUNT_PAT
})
