export default function getDatabaseObjectDefinitionSQL(
  schema: string,
  objectName: string,
  objectDefinition: string,
  objectType: 'VIEW' | 'MATERIALIZED VIEW',
): string {
  if (!objectDefinition) {
    return '';
  }

  if (objectType === 'MATERIALIZED VIEW') {
    const dropStatement = `DROP MATERIALIZED VIEW "${schema}"."${objectName}";`;
    const createStatement = `CREATE MATERIALIZED VIEW "${schema}"."${objectName}" AS\n${objectDefinition}`;
    return `${dropStatement}\n${createStatement}`;
  }

  return `CREATE OR REPLACE VIEW "${schema}"."${objectName}" AS\n${objectDefinition}`;
}
