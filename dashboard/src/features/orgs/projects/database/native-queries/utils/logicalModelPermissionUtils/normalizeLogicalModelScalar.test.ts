import { getAvailableOperators } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/getAvailableOperators';
import normalizeLogicalModelScalar from './normalizeLogicalModelScalar';

describe('normalizeLogicalModelScalar', () => {
  it.each([
    ['text', 'text'],
    ['TEXT', 'text'],
    ['character varying', 'varchar'],
    ['CHARACTER VARYING', 'varchar'],
    ['character', 'bpchar'],
    ['citext', 'citext'],
    ['json', 'json'],
    ['jsonb', 'jsonb'],
    ['custom_scalar', 'custom_scalar'],
  ])('normalizes %s to %s before selecting operators', (raw, normalized) => {
    expect(normalizeLogicalModelScalar(raw)).toBe(normalized);
    expect(getAvailableOperators(normalizeLogicalModelScalar(raw))).toEqual(
      getAvailableOperators(normalized),
    );
  });
});
