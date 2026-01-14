import type { RemoteField } from '@/utils/hasura-api/generated/schemas';
import { z } from 'zod';

enum ToReferenceSourceTypePrefix {
  REMOTE_SCHEMA = 'remote-schema-',
  SOURCE = 'source-',
}

export type ToReferenceSourceValue =
  | `${ToReferenceSourceTypePrefix}${string}`
  | '';

export class ReferenceSource {
  private prefix: ToReferenceSourceTypePrefix;

  private nameStr: string;

  constructor(value: ToReferenceSourceValue) {
    this.prefix = value.startsWith(ToReferenceSourceTypePrefix.REMOTE_SCHEMA)
      ? ToReferenceSourceTypePrefix.REMOTE_SCHEMA
      : ToReferenceSourceTypePrefix.SOURCE;
    this.nameStr = value.slice(this.prefix.length);
  }

  get name(): string {
    return this.nameStr;
  }

  get fullValue(): ToReferenceSourceValue {
    return `${this.prefix}${this.nameStr}`;
  }

  get type(): 'remoteSchema' | 'source' {
    return this.prefix === ToReferenceSourceTypePrefix.REMOTE_SCHEMA
      ? 'remoteSchema'
      : 'source';
  }

  static createTypeSourceFromName(name: string): ReferenceSource {
    return new ReferenceSource(`${ToReferenceSourceTypePrefix.SOURCE}${name}`);
  }

  static createTypeRemoteSchemaFromName(name: string): ReferenceSource {
    return new ReferenceSource(
      `${ToReferenceSourceTypePrefix.REMOTE_SCHEMA}${name}`,
    );
  }
}

const baseRelationshipFormSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  fromSource: z.object(
    {
      schema: z.string().min(1),
      table: z.string().min(1),
      source: z.string().min(1),
    },
    { required_error: 'From source is required' },
  ),
});

const fieldMappingSchema = z.object({
  sourceColumn: z.string().min(1, { message: 'Source column is required' }),
  referenceColumn: z
    .string()
    .min(1, { message: 'Reference column is required' }),
});

const tableRelationshipFormSchema = baseRelationshipFormSchema.extend({
  referenceKind: z.literal('table'),
  toReference: z.object({
    source: z
      .string()
      .min(1, { message: 'Source is required' })
      .transform((v) => v as ToReferenceSourceValue),
    schema: z.string().min(1, { message: 'Schema is required' }),
    table: z.string().min(1, { message: 'Table is required' }),
  }),
  relationshipType: z.enum(['array', 'object'], {
    required_error: 'Relationship type is required',
  }),
  fieldMapping: z.array(fieldMappingSchema),
});

const remoteSchemaRelationshipFormSchema = baseRelationshipFormSchema.extend({
  referenceKind: z.literal('remoteSchema'),
  toReference: z.object({
    source: z
      .string()
      .min(1, { message: 'Source is required' })
      .transform((v) => v as ToReferenceSourceValue),
    schema: z.string().optional(),
    table: z.string().optional(),
  }),
  remoteSchema: z.object({
    remoteSchema: z.string().min(1, { message: 'Remote schema is required' }),
    lhsFields: z.array(z.string()),
    remoteField: z.custom<RemoteField>(),
  }),
});

export const relationshipFormSchema = z
  .discriminatedUnion('referenceKind', [
    tableRelationshipFormSchema,
    remoteSchemaRelationshipFormSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.referenceKind === 'remoteSchema') {
      if (!data.remoteSchema?.remoteField) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please provide at least one remote field.',
          path: ['remoteSchema'],
        });
      }

      return;
    }

    if (data.relationshipType === 'array' && data.fieldMapping.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'At least one column mapping is required for array relationships.',
        path: ['fieldMapping'],
      });
    }
  });

export const defaultFormValues: BaseRelationshipFormInitialValues = {
  name: '',
  fromSource: {
    schema: '',
    table: '',
    source: '',
  },
  referenceKind: 'table',
  toReference: {
    source: '',
    schema: '',
    table: '',
  },
  relationshipType: 'object',
  fieldMapping: [],
};

export const buildDefaultFormValues = (
  source: string,
  schema: string,
  table: string,
): BaseRelationshipFormInitialValues => ({
  ...defaultFormValues,
  fromSource: { source, schema, table },
});

export type BaseRelationshipFormValues = z.infer<typeof relationshipFormSchema>;

export type RemoteSchemaRelationshipFormValues = Extract<
  BaseRelationshipFormValues,
  { referenceKind: 'remoteSchema' }
>;

export type TableRelationshipFormValues = Extract<
  BaseRelationshipFormValues,
  { referenceKind: 'table' }
>;

export type BaseRelationshipFormInitialValues = TableRelationshipFormValues;
