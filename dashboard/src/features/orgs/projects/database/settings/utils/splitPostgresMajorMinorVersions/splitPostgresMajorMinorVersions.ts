/**
 * Splits a Postgres version string into major and minor versions.
 * @param version - The Postgres version string to split.
 * @returns An object containing the major and minor versions.
 * It returns an empty string for the minor version if no minor version is present.
 */
export default function splitPostgresMajorMinorVersions(version: string) {
  const splitIndex = version.indexOf('.');

  if (splitIndex === -1) {
    return {
      major: version,
      minor: '',
    };
  }

  const major = version.slice(0, splitIndex);
  const minor = version.slice(splitIndex + 1);

  return {
    major,
    minor,
  };
}
