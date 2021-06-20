import path from 'path'
import { castIntEnv, castStringArrayEnv } from '@config/utils'

/**
 * * Authentication settings
 */
export const JWT = {
  get KEY() {
    return process.env.JWT_KEY || ''
  },
  get ALGORITHM() {
    return process.env.JWT_ALGORITHM || 'RS256'
  },
  get CLAIMS_NAMESPACE() {
    return process.env.JWT_CLAIMS_NAMESPACE || 'https://hasura.io/jwt/claims'
  },
  get KEY_FILE_PATH() {
    return path.resolve(process.env.PWD || '.', 'keys/private.pem')
  },
  get EXPIRES_IN() {
    return castIntEnv('JWT_EXPIRES_IN', 15)
  },
  get REFRESH_EXPIRES_IN() {
    return castIntEnv('JWT_REFRESH_EXPIRES_IN', 43200)
  },
  get CUSTOM_FIELDS() {
    return castStringArrayEnv('JWT_CUSTOM_FIELDS')
  },
}
