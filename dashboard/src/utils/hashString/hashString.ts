// A stable, unsigned 32-bit hash of a string, for picking the same color or
// style for the same name every time.
export default function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
