/**
 * Escapes the characters that have a special meaning in a regular expression,
 * so `input` is matched literally.
 */
export default function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
