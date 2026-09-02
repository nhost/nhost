import { CONSTRAINT_DEFINITION_QUERY } from '@/features/orgs/projects/database/common/utils/sqlTemplates';

describe('CONSTRAINT_DEFINITION_QUERY', () => {
  it('avoids PostgreSQL-version-specific pg_index columns', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).not.toContain('INDNULLSNOTDISTINCT');
  });

  it('only excludes indexes owned by constraints on the same table', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).toMatch(
      /WHERE CON\.CONINDID = IDX\.INDEXRELID\s+AND CON\.CONRELID = IDX\.INDRELID/,
    );
  });
});
