/**
 * Reads the message off a field-array error. Array-level errors land on `root`
 * when the array also holds per-item errors, and directly on the error
 * otherwise, so both positions have to be checked.
 */
export default function getFieldArrayErrorMessage(
  error: { message?: unknown; root?: { message?: unknown } } | undefined,
): string | undefined {
  if (typeof error?.message === 'string') {
    return error.message;
  }

  if (typeof error?.root?.message === 'string') {
    return error.root.message;
  }

  return undefined;
}
