import type { Passkey } from '@/app/auth/passkey/manage/actions';
import { describeUserAgent } from '@/lib/nhost/session-metadata';

/**
 * The name a new passkey starts with: the browser and system it is added
 * from, worded as the Sessions list words them. Nothing when the user agent
 * names neither.
 */
export function deviceName(userAgent: string | undefined): string | undefined {
  const name = describeUserAgent(userAgent);
  return name === 'Unknown device' ? undefined : name;
}

/**
 * `name`, or, when a passkey already has it, `name` with the first number
 * from 2 up that none has: "Chrome - macOS 2".
 */
export function unusedName(name: string, taken: Array<string | null>): string {
  const names = new Set(taken);
  if (!names.has(name)) {
    return name;
  }

  let n = 2;
  while (names.has(`${name} ${n}`)) {
    n += 1;
  }
  return `${name} ${n}`;
}

/**
 * A passkey as a list shows it: its name, or, for one saved without one, its
 * place in the list.
 */
export function passkeyName(
  key: Pick<Passkey, 'nickname'>,
  index: number,
): string {
  return key.nickname || `Passkey ${index + 1}`;
}
