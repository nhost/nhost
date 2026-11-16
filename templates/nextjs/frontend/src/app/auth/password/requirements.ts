/** What the password forms check while you type. */
export const PASSWORD_MIN_LENGTH = 9;
// Auth's API refuses a longer one with a bare `schema-validation-error`.
export const PASSWORD_MAX_LENGTH = 50;

export type Requirement = { label: string; met: boolean };

/** The rules, each with whether `password` meets it yet. */
export function passwordRequirements(
  password: string,
  confirm?: string,
): Requirement[] {
  // Auth counts characters, not the UTF-16 units `length` counts.
  const length = [...password].length;
  const rules: Requirement[] = [
    {
      label: `${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`,
      met: length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH,
    },
  ];

  if (confirm !== undefined) {
    rules.push({
      label: 'Both entries match',
      // Two empty fields match, which is not an achievement worth ticking.
      met: password.length > 0 && password === confirm,
    });
  }

  return rules;
}

/** Whether `password` meets every rule, so the form can be sent. */
export const meetsRequirements = (password: string, confirm?: string) =>
  passwordRequirements(password, confirm).every((rule) => rule.met);
