/**
 * What the password forms check while you type.
 *
 * The auth service is what enforces this, from
 * `auth.method.emailPassword.passwordMinLength` in `nhost/nhost.toml`. The
 * number below is the form's copy of it, so the two have to move together:
 * raise it there alone and a password this still calls fine comes back
 * rejected by the server.
 *
 * Length is the whole list because length is the whole policy. The auth
 * service has no rule about case, digits or symbols, so a form demanding
 * them would be turning away passwords the backend would have accepted. The
 * other rule it can be given, `hibpEnabled`, asks whether a password has
 * appeared in a breach, which only the server can answer and so cannot be
 * ticked off as you type. It is off in this template.
 */
export const PASSWORD_MIN_LENGTH = 9;

export type Requirement = { label: string; met: boolean };

/**
 * The rules, each with whether `password` meets it yet.
 *
 * `confirm` is passed only by the forms that ask for the password twice.
 * Leaving it out drops that row rather than showing one that can never be
 * met.
 */
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
