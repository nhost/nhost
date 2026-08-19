import { CONSTRAINT_DEFINITION_QUERY } from '@/features/orgs/projects/database/common/utils/sqlTemplates';

describe('CONSTRAINT_DEFINITION_QUERY', () => {
  it('preserves constraint and index key ordinality', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'UNNEST(CON.CONKEY) WITH ORDINALITY',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'UNNEST(IDX.INDKEY) WITH ORDINALITY',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'AK.ORDINALITY AS COLUMN_ORDINALITY',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'ORDER BY CONSTRAINT_TYPE, CONSTRAINT_NAME, COLUMN_ORDINALITY',
    );
  });

  it('excludes ineligible constraint-backed candidate keys', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain('NOT CON.CONDEFERRABLE');
    expect(CONSTRAINT_DEFINITION_QUERY).toContain('NOT CON.CONDEFERRED');
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'CONSTRAINT_INDEX.INDIMMEDIATE',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'CONSTRAINT_INDEX.INDISVALID',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'CONSTRAINT_INDEX.INDISREADY',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain('CONSTRAINT_INDEX.INDISLIVE');
  });

  it('includes only eligible standalone unique index key columns', () => {
    for (const condition of [
      'IDX.INDISUNIQUE',
      'IDX.INDISVALID',
      'IDX.INDISREADY',
      'IDX.INDISLIVE',
      'IDX.INDIMMEDIATE',
      'NOT IDX.INDISPRIMARY',
      'IDX.INDPRED IS NULL',
      'IDX.INDEXPRS IS NULL',
      'ATTR.ATTNUM > 0',
    ]) {
      expect(CONSTRAINT_DEFINITION_QUERY).toContain(condition);
    }
  });

  it('excludes INCLUDE-only columns and constraint-backed index duplicates', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'AK.ORDINALITY <= IDX.INDNKEYATTS',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'AK.ORDINALITY <= CONSTRAINT_INDEX.INDNKEYATTS',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'WHERE CON.CONINDID = IDX.INDEXRELID',
    );
  });
});
