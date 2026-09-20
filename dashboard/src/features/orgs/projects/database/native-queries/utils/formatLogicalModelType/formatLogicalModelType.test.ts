import { formatLogicalModelType } from '@/features/orgs/projects/database/native-queries/utils/formatLogicalModelType';

describe('formatLogicalModelType', () => {
  it('formats scalar types', () => {
    expect(formatLogicalModelType({ scalar: 'text', nullable: false })).toBe(
      'text',
    );
    expect(formatLogicalModelType({ scalar: 'text', nullable: true })).toBe(
      'text | null',
    );
  });

  it('formats logical model references', () => {
    expect(
      formatLogicalModelType({ logical_model: 'author', nullable: false }),
    ).toBe('author');
  });

  it('formats arrays, parenthesising nullable items', () => {
    expect(
      formatLogicalModelType({
        array: { scalar: 'text', nullable: false },
        nullable: false,
      }),
    ).toBe('text[]');
    expect(
      formatLogicalModelType({
        array: { scalar: 'text', nullable: true },
        nullable: true,
      }),
    ).toBe('(text | null)[] | null');
  });
});
