export const enabledDeprecationWarning = (envVar: string) => {
  const oldVersion = `${envVar}_ENABLE`
  const newVersion = `${envVar}_ENABLED`

  // eslint-disable-next-line
  if(process.env.hasOwnProperty(oldVersion))
    console.warn(`Deprecation warning: '${oldVersion}' env var will be removed in the next major release. Please use '${newVersion}' instead`)
}

[
  // Storage
  'STORAGE',
  'S3_SSL',

  // Application
  'EMAILS',
  'GRAVATAR',

  // Registration
  'HIBP',

  // Providers
  'GITHUB',
  'GOOGLE',
  'FACEBOOK',
  'TWITTER',
  'LINKEDIN',
  'APPLE',
  'WINDOWS_LIVE',
  'SPOTIFY',
  'GITLAB',
  'BITBUCKET',

  // MFA
  'MFA',

  // Authentication
  'AUTH',
  'AUTH_LOCAL_USERS',
  'CHANGE_EMAIL',
  'ANONYMOUS_USERS',
  'LOST_PASSWORD',
  'USER_IMPERSONATION',
  'MAGIC_LINK',
].forEach(env => enabledDeprecationWarning(env))