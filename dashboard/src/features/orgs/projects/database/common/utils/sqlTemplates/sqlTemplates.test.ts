import { CONSTRAINT_DEFINITION_QUERY } from '@/features/orgs/projects/database/common/utils/sqlTemplates';

describe('CONSTRAINT_DEFINITION_QUERY', () => {
  it('supports PostgreSQL 14, where pg_index.indnullsnotdistinct is unavailable', () => {
    expect(CONSTRAINT_DEFINITION_QUERY).not.toContain('INDNULLSNOTDISTINCT');
  });
});
