import { z } from 'zod';
import { isNotEmptyValue } from '@/lib/utils';
import type { RemoteFieldArguments } from '@/utils/hasura-api/generated/schemas';

export type RemoteFieldForm = Record<
  string,
  {
    arguments?: RemoteFieldArguments;
    field?: Record<string, unknown>;
  }
>;

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

export const getRelationshipNameSchema = (fieldName: string) =>
  z
    .string()
    .min(1, { message: `${fieldName} is required` })
    .regex(/^([A-Za-z]|_)+/i, {
      message: `${fieldName} must start with a letter or underscore.`,
    })
    .regex(/^\w+$/i, {
      message: `${fieldName} must contain only letters, numbers, or underscores.`,
    });

const baseRelationshipFormSchema = z.object({
  name: getRelationshipNameSchema('Name'),
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
    source: z.string().min(1, { message: 'Source is required' }),
    schema: z.string().min(1, { message: 'Schema is required' }),
    table: z.string().min(1, { message: 'Table is required' }),
  }),
  relationshipType: z.enum(
    ['pg_create_array_relationship', 'pg_create_object_relationship'],
    {
      required_error: 'Relationship type is required',
    },
  ),
  fieldMapping: z
    .array(fieldMappingSchema)
    .min(1, { message: 'At least one column mapping is required' }),
});

const remoteSchemaRelationshipFormSchema = baseRelationshipFormSchema.extend({
  referenceKind: z.literal('remoteSchema'),
  toReference: z.object({
    source: z.string().min(1, { message: 'Source is required' }),
    schema: z.string().optional(),
    table: z.string().optional(),
  }),
  remoteSchema: z.object({
    name: z.string().min(1, { message: 'Remote schema is required' }),
    lhsFields: z.array(z.string()),
    remoteField: z
      .custom<RemoteFieldForm>(isNotEmptyValue, {
        message: 'Please provide at least one remote field.',
        path: ['remoteSchema'],
      })
      .optional(),
  }),
});

export const relationshipFormSchema = z.discriminatedUnion('referenceKind', [
  tableRelationshipFormSchema,
  remoteSchemaRelationshipFormSchema,
]);

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
  relationshipType: 'pg_create_object_relationship',
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

export type BaseRelationshipFormInitialValues = BaseRelationshipFormValues;
