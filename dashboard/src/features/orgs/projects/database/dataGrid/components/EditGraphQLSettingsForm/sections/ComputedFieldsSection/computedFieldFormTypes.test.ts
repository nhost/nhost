import type {
  ComputedFieldItem,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';
import {
  type ComputedFieldFormValues,
  computedFieldItemToFormValues,
  formValuesToAddComputedFieldArgs,
} from './computedFieldFormTypes';

const TABLE: QualifiedTable = { name: 'users', schema: 'public' };
const SOURCE = 'default';

const baseFormValues: ComputedFieldFormValues = {
  name: 'full_name',
  functionSchema: 'public',
  functionName: 'compute_full_name',
  tableArgument: '',
  sessionArgument: '',
  comment: '',
};

describe('computedFieldItemToFormValues', () => {
  it('maps a complete computed field to form values', () => {
    const item: ComputedFieldItem = {
      name: 'age',
      definition: {
        function: { schema: 'public', name: 'calculate_age' },
        table_argument: 'oracle_row',
        session_argument: 'user_session',
      },
      comment: 'Age computed from birthdate',
    };

    expect(computedFieldItemToFormValues(item)).toEqual({
      name: 'age',
      functionSchema: 'public',
      functionName: 'calculate_age',
      tableArgument: 'oracle_row',
      sessionArgument: 'user_session',
      comment: 'Age computed from birthdate',
    });
  });

  it('replaces missing optional fields with empty strings', () => {
    const item: ComputedFieldItem = {
      name: 'age',
      definition: {
        function: { schema: 'public', name: 'calculate_age' },
      },
    };

    expect(computedFieldItemToFormValues(item)).toEqual({
      name: 'age',
      functionSchema: 'public',
      functionName: 'calculate_age',
      tableArgument: '',
      sessionArgument: '',
      comment: '',
    });
  });

  it('treats null table_argument and session_argument as empty', () => {
    const item: ComputedFieldItem = {
      name: 'age',
      definition: {
        function: { schema: 'public', name: 'calculate_age' },
        table_argument: null,
        session_argument: null,
      },
    };

    const values = computedFieldItemToFormValues(item);
    expect(values.tableArgument).toBe('');
    expect(values.sessionArgument).toBe('');
  });
});

describe('formValuesToAddComputedFieldArgs', () => {
  it('builds an AddComputedFieldArgs payload with required fields only', () => {
    const args = formValuesToAddComputedFieldArgs(
      baseFormValues,
      TABLE,
      SOURCE,
    );

    expect(args).toEqual({
      table: TABLE,
      name: 'full_name',
      definition: {
        function: { schema: 'public', name: 'compute_full_name' },
      },
      source: 'default',
    });
  });

  it('includes optional definition fields when filled in', () => {
    const args = formValuesToAddComputedFieldArgs(
      {
        ...baseFormValues,
        tableArgument: 'oracle_row',
        sessionArgument: 'user_session',
        comment: 'A custom comment',
      },
      TABLE,
      SOURCE,
    );

    expect(args.definition.table_argument).toBe('oracle_row');
    expect(args.definition.session_argument).toBe('user_session');
    expect(args.comment).toBe('A custom comment');
  });

  it('omits optional fields that are blank or whitespace-only', () => {
    const args = formValuesToAddComputedFieldArgs(
      {
        ...baseFormValues,
        tableArgument: '   ',
        sessionArgument: '',
        comment: '\t\n',
      },
      TABLE,
      SOURCE,
    );

    expect(args.definition).not.toHaveProperty('table_argument');
    expect(args.definition).not.toHaveProperty('session_argument');
    expect(args).not.toHaveProperty('comment');
  });

  it('trims whitespace around populated values', () => {
    const args = formValuesToAddComputedFieldArgs(
      {
        ...baseFormValues,
        name: '  full_name  ',
        tableArgument: '  oracle_row  ',
        sessionArgument: '  user_session  ',
        comment: '  hi  ',
      },
      TABLE,
      SOURCE,
    );

    expect(args.name).toBe('full_name');
    expect(args.definition.table_argument).toBe('oracle_row');
    expect(args.definition.session_argument).toBe('user_session');
    expect(args.comment).toBe('hi');
  });

  it('preserves the provided table and source on the payload', () => {
    const args = formValuesToAddComputedFieldArgs(
      baseFormValues,
      { name: 'orders', schema: 'sales' },
      'analytics',
    );

    expect(args.table).toEqual({ name: 'orders', schema: 'sales' });
    expect(args.source).toBe('analytics');
  });
});
