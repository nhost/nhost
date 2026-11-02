/** What the password forms check while you type. */
export const PASSWORD_MIN_LENGTH = 9;

export type Requirement = { label: string; met: boolean };

/** The rules, each with whether `password` meets it yet. */
export function passwordRequirements(
  password: string,
  confirm?: string,
): Requirement[] {
  const rules: Requirement[] = [
    {
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: password.length >= PASSWORD_MIN_LENGTH,
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
