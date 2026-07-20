import { CONSTRAINT_DEFINITION_QUERY } from '@/features/orgs/projects/database/common/utils/sqlTemplates/sqlTemplates';

describe('CONSTRAINT_DEFINITION_QUERY', () => {
  it('returns classified key rows with explicit column ordinality', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, CONSTRAINT_DEFINITION, COLUMN_NAME, COLUMN_ORDINALITY',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain('UNION ALL');
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      `'i'::"char" AS CONSTRAINT_TYPE`,
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'NULL::TEXT AS CONSTRAINT_DEFINITION',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toMatch(
      /SELECT ROW_TO_JSON\(TABLE_DATA\) FROM \(\s+SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, CONSTRAINT_DEFINITION, COLUMN_NAME, COLUMN_ORDINALITY/,
    );
  });

  it('restricts synthetic rows to standalone usable key-only unique indexes', () => {
    const requiredFragments = [
      'AK.ORDINALITY <= IDX.INDNKEYATTS',
      'IDX.INDISUNIQUE',
      'IDX.INDISVALID',
      'IDX.INDISREADY',
      'IDX.INDISLIVE',
      'NOT IDX.INDISPRIMARY',
      'IDX.INDPRED IS NULL',
      'IDX.INDEXPRS IS NULL',
      'CON.CONINDID = IDX.INDEXRELID',
      'ATTR.ATTRELID = IDX.INDRELID',
      'ATTR.ATTNUM = AK.K',
      'ATTR.ATTNUM > 0',
    ];

    for (const fragment of requiredFragments) {
      expect(CONSTRAINT_DEFINITION_QUERY).toContain(fragment);
    }

    expect(CONSTRAINT_DEFINITION_QUERY).toMatch(
      /NOT EXISTS \(\s+SELECT 1\s+FROM PG_CONSTRAINT CON\s+WHERE CON\.CONINDID = IDX\.INDEXRELID\s+\)/,
    );
  });

  it('orders both branches by local ordinality before projecting JSON rows', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'UNNEST(CON.CONKEY) WITH ORDINALITY AS AK(K, ORDINALITY)',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'UNNEST(IDX.INDKEY) WITH ORDINALITY AS AK(K, ORDINALITY)',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'ORDER BY CONSTRAINT_TYPE, CONSTRAINT_NAME, COLUMN_ORDINALITY',
    );
  });

  it('requires separate live PostgreSQL execution in addition to structural coverage', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      "IDX.INDRELID = '%1$I.%2$I'::REGCLASS",
    );
  });
});
