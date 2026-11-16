import { formatColumnList } from '@/features/orgs/projects/database/dataGrid/utils/formatColumnList';

describe('formatColumnList', () => {
  it('returns a single column as is', () => {
    expect(formatColumnList(['author_id'])).toBe('author_id');
  });

  it('wraps several columns in parentheses', () => {
    expect(formatColumnList(['tenant_id', 'order_id'])).toBe(
      '(tenant_id, order_id)',
    );
  });
});
