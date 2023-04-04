/**
 * Labels used for prettified sizes.
 */
export const defaultLabels = [
  'Bytes',
  'KB',
  'MB',
  'GB',
  'TB',
  'PB',
  'EB',
  'ZB',
  'YB',
];

export interface PrettifySizeOptions {
  /**
   * Multiplier for size. Useful for converting to other units such as KiB, MiB,
   * etc.
   *
   * @default 1000
   */
  multiplier?: number;
  /**
   * Labels used for prettified sizes. Must be an array with at least 9
   * elements.
   *
   * @default ['Bytes','KB','MB','GB','TB','PB','EB','ZB','YB']
   */
  labels?: string[];
  /**
   * Maximum number of decimals to use.
   *
   * @default 2
   */
  numberOfDecimals?: number;
}

/**
 * Prettify a size that is in bytes.
 *
 * @params size - Size in bytes
 * @param options - Configuration options
 * @returns Prettified size
 */
export default function prettifySize(
  size: number,
  options?: PrettifySizeOptions,
) {
  const {
    multiplier = 1000,
    numberOfDecimals = 2,
    labels = defaultLabels,
  } = options || {};

  if (labels.length < 9) {
    throw new Error('Labels must be an array with at least 9 elements.');
  }

  if (size < multiplier) {
    return `${size} ${labels[0]}`;
  }

  const power = Math.min(
    labels.length,
    Math.floor(Math.log(size) / Math.log(multiplier)),
  );
  const value = size / multiplier ** power;
  const label = labels[power];

  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: numberOfDecimals,
  })} ${label}`;
}
