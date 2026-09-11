import type { LogicalModelFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import { buildLogicalModelDTO } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';

const describedValues: LogicalModelFormValues = {
  source: 'analytics',
  name: 'invoice_summary',
  description: '  Invoice summary model  ',
  fields: [
    {
      name: 'id',
      type: { kind: 'scalar', scalar: 'uuid', nullable: false },
      description: '  Primary identifier  ',
    },
    {
      name: 'line_items',
      type: {
        kind: 'array',
        item: {
          kind: 'logical_model',
          logicalModel: 'invoice_line_item',
          nullable: true,
        },
        nullable: false,
      },
      description: '   ',
    },
  ],
};

describe('buildLogicalModelDTO', () => {
  it('splits the source from normalized operation arguments', () => {
    expect(buildLogicalModelDTO(describedValues)).toEqual({
      source: 'analytics',
      args: {
        name: 'invoice_summary',
        description: 'Invoice summary model',
        fields: [
          {
            name: 'id',
            type: { scalar: 'uuid', nullable: false },
            description: 'Primary identifier',
          },
          {
            name: 'line_items',
            type: {
              array: {
                logical_model: 'invoice_line_item',
                nullable: true,
              },
              nullable: false,
            },
          },
        ],
      },
    });
  });

  it('omits blank top-level and field descriptions', () => {
    expect(
      buildLogicalModelDTO({
        ...describedValues,
        description: '   ',
        fields: describedValues.fields.map((field) => ({
          ...field,
          description: '',
        })),
      }),
    ).toEqual({
      source: 'analytics',
      args: {
        name: 'invoice_summary',
        fields: [
          { name: 'id', type: { scalar: 'uuid', nullable: false } },
          {
            name: 'line_items',
            type: {
              array: {
                logical_model: 'invoice_line_item',
                nullable: true,
              },
              nullable: false,
            },
          },
        ],
      },
    });
  });
});
