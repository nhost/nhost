import { createLogicalModelFormSchema } from '@/features/orgs/projects/database/native-queries/components/LogicalModelForm';

const field = (name: string, description = '') => ({
  name,
  type: { kind: 'scalar' as const, scalar: 'text', nullable: true },
  description,
});

describe('logical model form validation', () => {
  it('requires a name and at least one complete recursive field', () => {
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name: '',
      description: '',
      fields: [
        {
          name: '',
          type: {
            kind: 'array',
            nullable: false,
            item: { kind: 'logical_model', logicalModel: '', nullable: true },
          },
          description: '',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate field names', () => {
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name: 'result',
      description: '',
      fields: [field('id'), field('id')],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ message: 'Field names must be unique.' }),
    );
  });

  it('rejects collisions while allowing an unchanged edit name', () => {
    expect(
      createLogicalModelFormSchema(['result']).safeParse({
        source: 'default',
        name: 'result',
        description: '',
        fields: [field('id')],
      }).success,
    ).toBe(false);
    expect(
      createLogicalModelFormSchema(['result'], 'result').safeParse({
        source: 'default',
        name: 'result',
        description: '',
        fields: [field('id')],
      }).success,
    ).toBe(true);
  });

  it('keeps top-level and field descriptions untransformed in form state', () => {
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name: 'result',
      description: '  Model description  ',
      fields: [field('id', '  Field description  ')],
    });

    expect(result).toEqual({
      success: true,
      data: {
        source: 'default',
        name: 'result',
        description: '  Model description  ',
        fields: [field('id', '  Field description  ')],
      },
    });
  });
});
