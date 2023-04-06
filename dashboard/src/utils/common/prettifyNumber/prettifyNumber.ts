export interface PrettifyNumberOptions {
  /**
   * Multiplier for value. Useful if you want to convert to a different unit.
   * Must be greater than 0.
   *
   * @default 1000
   */
  multiplier?: number;
  /**
   * Labels used for prettified numbers.
   *
   * @default ['','k','M','B','T']
   */
  labels?: string[];
  /**
   * Maximum number of decimals to use.
   *
   * @default 2
   */
  numberOfDecimals?: number;
  /**
   * Separator between value and label.
   *
   * @default ''
   */
  separator?: string;
}

function formatValue(value: number, numberOfDecimals: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: numberOfDecimals,
    useGrouping: false,
  });
}

/**
 * Prettify a `value`. For every `multiplier` the value will be divided and the
 * next label will be used.
 *
 * @example
 * ```js
 * 1000 => '1k' // Given that "k" is the next label
 * 1000000 => '1M' // Given that "M" is the next label
 * 1234567 => '1.23M' // Given that "M" is the next label
 * ```
 *
 * @param value - Value to prettify
 * @param options - Configuration options
 * @returns Prettified value
 */
export default function prettifyNumber(
  value: number,
  options?: PrettifyNumberOptions,
) {
  const {
    multiplier = 1000,
    numberOfDecimals = 2,
    labels = ['', 'k', 'M', 'B', 'T'],
    separator = '',
  } = options || {};

  if (multiplier < 0) {
    throw new Error('Multiplier must be greater than 0');
  }

  if (Math.abs(value) < multiplier) {
    const label = labels?.[0];

    return [formatValue(value, numberOfDecimals), label]
      .filter(Boolean)
      .join(separator)
      .trim();
  }

  // Power should be between 0 and the length of the labels array
  const power = Math.min(
    Math.max(labels.length - 1, 0),
    Math.floor(Math.log(Math.abs(value)) / Math.log(multiplier)),
  );

  const formattedValue = formatValue(
    value / multiplier ** power,
    numberOfDecimals,
  );

  const label = labels?.[power];

  return [formattedValue, label].filter(Boolean).join(separator).trim();
}
