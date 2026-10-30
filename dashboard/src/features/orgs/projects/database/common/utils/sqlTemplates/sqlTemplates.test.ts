import { CONSTRAINT_DEFINITION_QUERY } from '@/features/orgs/projects/database/common/utils/sqlTemplates';

describe('CONSTRAINT_DEFINITION_QUERY', () => {
  it('returns standalone unique indexes in the constraint row shape', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain('IND.INDISUNIQUE');
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      `'i'::"char" AS CONSTRAINT_TYPE`,
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(`'UNIQUE (' || STRING_AGG(`);
  });

  it.each([
    ['partial', 'IND.INDPRED IS NULL'],
    ['expression', 'IND.INDEXPRS IS NULL'],
    ['invalid', 'IND.INDISVALID'],
    ['not-ready', 'IND.INDISREADY'],
  ])('excludes %s indexes', (_, eligibilityPredicate) => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(eligibilityPredicate);
  });

  it('excludes indexes backed by primary or unique constraints', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'INDEX_CONSTRAINT.CONINDID = IND.INDEXRELID',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      "INDEX_CONSTRAINT.CONTYPE IN ('p', 'u')",
    );
  });

  it('uses unique index key columns in index order', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'INDEX_KEY.ORDINALITY <= IND.INDNKEYATTS',
    );
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      'ATTR.ATTNAME ORDER BY INDEX_KEY.ORDINALITY',
    );
  });

  it('keeps constraint-backed keys ahead of standalone indexes', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toContain(
      "CASE WHEN KEY_DATA.CONSTRAINT_TYPE = 'i' THEN 1 ELSE 0 END",
    );
  });
});
