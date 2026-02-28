/**
 * Compares two version strings (e.g., "0.46.0") and returns true
 * if `version` is greater than or equal to `minVersion`.
 *
 * Only considers numeric major.minor.patch segments.
 */
export function isVersionGte(
  version: string | null | undefined,
  minVersion: string,
): boolean {
  if (!version) {
    return false;
  }

  const parse = (v: string) =>
    v
      .split('.')
      .slice(0, 3)
      .map((s) => Number.parseInt(s, 10) || 0);

  const [aMajor = 0, aMinor = 0, aPatch = 0] = parse(version);
  const [bMajor = 0, bMinor = 0, bPatch = 0] = parse(minVersion);

  if (aMajor !== bMajor) {
    return aMajor > bMajor;
  }
  if (aMinor !== bMinor) {
    return aMinor > bMinor;
  }
  return aPatch >= bPatch;
}
