export default function splitPostgresMajorMinorVersions(version: string) {
  const splitIndex = version.indexOf('.');

  const major = version.slice(0, splitIndex);
  const minor = version.slice(splitIndex + 1);

  return {
    major,
    minor,
  };
}
