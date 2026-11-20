import {
  clearDeviceItem,
  getDeviceItem,
  setDeviceItem,
} from '@/lib/deviceStore';

// Set when a password-reset link signs the user in, and holds the screen the
// link landed on. Kept beside the session in SecureStore, so it outlives a
// relaunch as the session does.
const PASSWORD_RESET_KEY = 'nhostPasswordReset';
export const PASSWORD_RESET_LINK_TYPE = 'passwordReset';

export function startPasswordReset(page: string): void {
  setDeviceItem(PASSWORD_RESET_KEY, page);
}

/** The reset screen the user has to stay on, if a reset is under way. */
export function pendingPasswordReset(): string | null {
  return getDeviceItem(PASSWORD_RESET_KEY);
}

/** Lets the user leave the reset screen, once the new password is saved. */
export function endPasswordReset(): void {
  clearDeviceItem(PASSWORD_RESET_KEY);
}
