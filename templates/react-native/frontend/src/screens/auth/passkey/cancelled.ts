// react-native-passkey rejects with `{ error, message }`, where `error` is its
// name for what the OS reported.
const errorName = (err: unknown): string | undefined =>
  (err as { error?: string } | null)?.error;

// A dismissed or timed-out prompt, on either OS.
export function wasCancelled(err: unknown): boolean {
  return errorName(err) === 'UserCancelled';
}

// Signing in, the device holds no passkey for this app.
export function noPasskeyHere(err: unknown): boolean {
  return errorName(err) === 'NoCredentials';
}

/**
 * Whether the device refused to add a passkey because it already holds one of
 * the account's: the auth service lists them as excluded, and the OS refuses
 * with what react-native-passkey calls CredentialAlreadyExists.
 */
export function alreadyRegistered(err: unknown): boolean {
  return errorName(err) === 'CredentialAlreadyExists';
}
