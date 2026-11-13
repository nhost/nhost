// The role ends with the transaction that runs the SQL, so it cannot outlive
// it on a pooled connection even if the SQL is edited.
export default function withPostgresRole(statement: string): string {
  return `SET LOCAL ROLE postgres;\n${statement};`;
}
