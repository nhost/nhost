import crypto from 'crypto'

/**
 * Creates a hash using the SHA256 algorithm.
 *
 * @param value - The value to hash
 * @returns The hashed value
 */
export function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}
