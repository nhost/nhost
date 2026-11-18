// Set when a password-reset link signs the visitor in, and holds the page the
// link landed on. Kept beside the session in `localStorage`, so every tab sees
// it.
export const PASSWORD_RESET_KEY = 'nhostPasswordReset';
export const PASSWORD_RESET_LINK_TYPE = 'passwordReset';

export function startPasswordReset(page: string): void {
  window.localStorage.setItem(PASSWORD_RESET_KEY, page);
}

/** The reset page the visitor has to stay on, if a reset is under way. */
export function pendingPasswordReset(): string | null {
  return window.localStorage.getItem(PASSWORD_RESET_KEY);
}

/** Lets the visitor leave the reset page, once the new password is saved. */
export function endPasswordReset(): void {
  window.localStorage.removeItem(PASSWORD_RESET_KEY);
}
