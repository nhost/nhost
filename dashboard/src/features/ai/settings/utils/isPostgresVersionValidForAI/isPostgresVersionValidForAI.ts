/**
 * Check if the given postgres version is valid for enabling AI in the project
 *
 * @param postgresVersion - Postgres version used in the project.
 * @returns Whether is valid for enabling AI.
 */
export default function isPostgresVersionValidForAI(
  postgresVersion: string,
): boolean {
  const MIN_POSTGRES_VERSION_SUPPORTING_AI = '14.6-20231018-1';
  const [
    MIN_POSTGRES_MAJOR_VERSION_SUPPORTING_AI,
    MIN_POSTGRES_MINOR_VERSION_SUPPORTING_AI,
  ] = [14, 6]; // 14.6

  const [majorMinorVersion] = postgresVersion.split('-')
  const [postgresMajor, postgresMinor] = majorMinorVersion.split('.').map(Number)

  if (postgresMajor < MIN_POSTGRES_MAJOR_VERSION_SUPPORTING_AI) {
    return false;
  }

  if (postgresMajor === MIN_POSTGRES_MAJOR_VERSION_SUPPORTING_AI) {
    if (postgresMinor === MIN_POSTGRES_MINOR_VERSION_SUPPORTING_AI) {
      // Compare the full version if the major and minor version are the same
      if (postgresVersion < MIN_POSTGRES_VERSION_SUPPORTING_AI) {
        return false;
      }
    }
    if (postgresMinor < MIN_POSTGRES_MINOR_VERSION_SUPPORTING_AI) {
      return false;
    }
  }

  // postgres major version is greater than minimum version supporting AI, 
  // or minor version is greater than minimum version supporting AI
  return true;
}
