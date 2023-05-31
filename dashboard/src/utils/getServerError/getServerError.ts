/**
 * Returns a function that accepts an error and returns the error message if it
 * exists, otherwise returns the fallback message.
 *
 * @param fallbackMessage - Fallback message
 * @returns A function that accepts the error as an argument and returns the
 * error message if it exists, otherwise returns the fallback message.
 */
export default function getServerError(fallbackMessage: string) {
  return (error?: Error) =>
    error?.message ? `Error: ${error.message}` : fallbackMessage;
}
