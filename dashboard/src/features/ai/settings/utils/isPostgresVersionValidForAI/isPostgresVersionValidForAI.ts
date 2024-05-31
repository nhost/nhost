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

  if (/^14\.6-/.test(postgresVersion)) {
    return postgresVersion >= MIN_POSTGRES_VERSION_SUPPORTING_AI;
  }

  // Note: No need to account for versions less than 14.6
  return true;
}
