import { createLogicalModelFormSchema } from '@/features/orgs/projects/database/native-queries/components/LogicalModelForm';

const field = (name: string) => ({
  name,
  type: { kind: 'scalar' as const, scalar: 'text', nullable: true },
});

describe('logical model form validation', () => {
  it('requires a name and at least one complete recursive field', () => {
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name: '',
      fields: [
        {
          name: '',
          type: {
            kind: 'array',
            nullable: false,
            item: { kind: 'logical_model', logicalModel: '', nullable: true },
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate field names', () => {
    const result = createLogicalModelFormSchema([]).safeParse({
      source: 'default',
      name: 'result',
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
        fields: [field('id')],
      }).success,
    ).toBe(false);
    expect(
      createLogicalModelFormSchema(['result'], 'result').safeParse({
        source: 'default',
        name: 'result',
        fields: [field('id')],
      }).success,
    ).toBe(true);
  });
});
