import * as Device from 'expo-device';
import type { Passkey } from '@/screens/auth/passkey/manage/actions';

/**
 * The name a new passkey starts with: the model and system it is added from,
 * as "Pixel 8 - Android". The model, not the owner's name for the device,
 * which can hold their own name.
 */
export function deviceName({
  modelName,
  osName,
}: Pick<typeof Device, 'modelName' | 'osName'> = Device): string | undefined {
  if (modelName && osName) {
    return `${modelName} - ${osName}`;
  }

  return modelName ?? osName ?? undefined;
}

/**
 * `name`, or, when a passkey already has it, `name` with the first number from
 * 2 up that none has: "Pixel 8 - Android 2".
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
