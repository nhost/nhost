import type { Passkey } from '@/app/auth/passkey/manage/actions';

// Checked in order, so the browsers that put another's name in their user agent
// come before the one they name: Edge and Opera say Chrome, and every iOS
// browser says Safari.
const BROWSERS: Array<[RegExp, string]> = [
  [/\bEdg(e|A|iOS)?\//, 'Edge'],
  [/\b(OPR|OPiOS)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(Firefox|FxiOS)\//, 'Firefox'],
  [/\b(Chrome|CriOS|HeadlessChrome)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/\biPhone\b/, 'iOS'],
  [/\biPad\b/, 'iPadOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bMac OS X\b/, 'macOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bLinux\b/, 'Linux'],
];

/**
 * The name a new passkey starts with: the browser and system it is added from,
 * as "Chrome - macOS".
 */
export function deviceName(userAgent: string | undefined): string | undefined {
  if (!userAgent) {
    return undefined;
  }

  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];

  if (browser && system) {
    return `${browser} - ${system}`;
  }

  return browser ?? system;
}

/**
 * `name`, or, when a passkey already has it, `name` with the first number from
 * 2 up that none has: "Chrome - macOS 2".
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
