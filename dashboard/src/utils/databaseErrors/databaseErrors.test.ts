import { ApolloError } from '@apollo/client';
import { GraphQLError } from 'graphql';
import {
  errorMessageIncludes,
  getErrorMessageSuffix,
  getViolatedConstraint,
} from './databaseErrors';

function apolloError(message: string, extensions?: Record<string, unknown>) {
  return new ApolloError({
    graphQLErrors: [new GraphQLError(message, { extensions })],
  });
}

describe('getViolatedConstraint', () => {
  it('extracts the constraint from a foreign key violation', () => {
    const error = apolloError(
      'Foreign key violation. update or delete on table "users" violates foreign key constraint "apps_creator_user_id_fkey" on table "apps"',
      { code: 'constraint-violation' },
    );

    expect(getViolatedConstraint(error)).toBe('apps_creator_user_id_fkey');
  });

  it('extracts the constraint from a driver-wrapped foreign key violation', () => {
    const error = apolloError(
      'failed to execute operations: failed to execute operation deleteUser: failed to scan result row: ERROR: update or delete on table "users" violates foreign key constraint "apps_creator_user_id_fkey" on table "apps" (SQLSTATE 23503)',
    );

    expect(getViolatedConstraint(error)).toBe('apps_creator_user_id_fkey');
  });

  it('extracts the constraint from a RESTRICT foreign key violation (postgres 18+)', () => {
    const error = apolloError(
      'failed to execute operations: failed to execute operation deleteUser: failed to scan result row: ERROR: update or delete on table "users" violates RESTRICT setting of foreign key constraint "apps_creator_user_id_fkey" on table "apps" (SQLSTATE 23001)',
    );

    expect(getViolatedConstraint(error)).toBe('apps_creator_user_id_fkey');
  });

  it('extracts the constraint from a uniqueness violation', () => {
    const error = apolloError(
      'Uniqueness violation. duplicate key value violates unique constraint "organization_member_invites_organization_id_email_key"',
      { code: 'constraint-violation' },
    );

    expect(getViolatedConstraint(error)).toBe(
      'organization_member_invites_organization_id_email_key',
    );
  });

  it('returns null for unrelated errors', () => {
    expect(getViolatedConstraint(apolloError('field not found'))).toBeNull();
    expect(getViolatedConstraint(new Error('network error'))).toBeNull();
    expect(getViolatedConstraint(undefined)).toBeNull();
  });
});

describe('getErrorMessageSuffix', () => {
  it('extracts a suffix from a wrapped graphql error message', () => {
    const error = apolloError(
      'database query error: app is locked: Payment overdue',
    );

    expect(getErrorMessageSuffix(error, 'app is locked: ')).toBe(
      'Payment overdue',
    );
  });

  it('extracts a suffix from an internal postgres error message', () => {
    const error = apolloError('database query error', {
      internal: {
        error: {
          message: 'organization needs attention: contact support',
        },
      },
    });

    expect(getErrorMessageSuffix(error, 'organization needs attention: ')).toBe(
      'contact support',
    );
  });

  it('extracts a suffix from a plain error message', () => {
    expect(
      getErrorMessageSuffix(
        new Error('app is locked: Payment overdue'),
        'app is locked: ',
      ),
    ).toBe('Payment overdue');
  });

  it('strips the trailing SQLSTATE tag from driver-wrapped errors', () => {
    const error = apolloError(
      'failed to execute operations: failed to execute operation updateApps: failed to scan result row: ERROR: organization needs attention: contact support (SQLSTATE P0001)',
    );

    expect(getErrorMessageSuffix(error, 'organization needs attention: ')).toBe(
      'contact support',
    );
  });

  it('preserves the default lock reason', () => {
    const error = apolloError('app is locked: Reason unspecified');

    expect(getErrorMessageSuffix(error, 'app is locked: ')).toBe(
      'Reason unspecified',
    );
  });

  it('returns null when no message contains the prefix', () => {
    expect(
      getErrorMessageSuffix(apolloError('database query error'), 'missing: '),
    ).toBeNull();
    expect(getErrorMessageSuffix(undefined, 'missing: ')).toBeNull();
  });
});

describe('errorMessageIncludes', () => {
  it('matches against graphql error messages', () => {
    const error = apolloError('Cannot delete the last admin');

    expect(errorMessageIncludes(error, 'Cannot delete the last admin')).toBe(
      true,
    );
    expect(errorMessageIncludes(error, 'Cannot change the last admin')).toBe(
      false,
    );
  });

  it('matches against internal postgres error messages', () => {
    const error = apolloError('database query error', {
      code: 'unexpected',
      internal: {
        error: { message: 'Cannot delete the last admin' },
      },
    });

    expect(errorMessageIncludes(error, 'Cannot delete the last admin')).toBe(
      true,
    );
  });

  it('matches against plain error messages', () => {
    expect(
      errorMessageIncludes(new Error('something failed'), 'something'),
    ).toBe(true);
    expect(errorMessageIncludes(undefined, 'something')).toBe(false);
  });

  it('falls back to the apollo error message when there are no graphql errors', () => {
    const error = new ApolloError({
      networkError: new Error('Failed to fetch'),
    });

    expect(errorMessageIncludes(error, 'Failed to fetch')).toBe(true);
  });
});
