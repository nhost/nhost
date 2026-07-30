import { createNativeQueryFormSchema } from '@/features/orgs/projects/database/native-queries/components/NativeQueryForm';

const valid = {
  rootFieldName: 'search_authors',
  returns: 'author_result',
  code: 'SELECT * FROM authors',
  arguments: [
    { name: 'search', type: 'text', nullable: false, description: '' },
  ],
};

describe('createNativeQueryFormSchema', () => {
  it.each([
    [{ ...valid, rootFieldName: '' }, 'Root field name is required.'],
    [{ ...valid, code: '  ' }, 'SQL is required.'],
    [{ ...valid, returns: '' }, 'Select a return model.'],
  ])('requires the core native query fields', (values, message) => {
    const result = createNativeQueryFormSchema([]).safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(message);
    }
  });

  it('rejects duplicate argument names', () => {
    const result = createNativeQueryFormSchema([]).safeParse({
      ...valid,
      arguments: [...valid.arguments, { ...valid.arguments[0] }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.message === 'Argument names must be unique.',
        ),
      ).toBe(true);
    }
  });

  it('rejects collisions but permits an unchanged name while editing', () => {
    expect(
      createNativeQueryFormSchema(['search_authors']).safeParse(valid).success,
    ).toBe(false);
    expect(
      createNativeQueryFormSchema(
        ['search_authors'],
        'search_authors',
      ).safeParse(valid).success,
    ).toBe(true);
  });
});
