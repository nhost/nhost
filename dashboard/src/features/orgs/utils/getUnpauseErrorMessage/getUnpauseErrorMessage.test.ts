import { ApolloError } from '@apollo/client';
import { GraphQLError } from 'graphql';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';

function apolloError(message: string, extensions?: Record<string, unknown>) {
  return new ApolloError({
    graphQLErrors: [new GraphQLError(message, { extensions })],
  });
}

describe('getUnpauseErrorMessage', () => {
  it('surfaces when the organization needs attention', () => {
    const error = apolloError('database query error', {
      internal: {
        error: {
          message: 'organization needs attention: contact support',
        },
      },
    });

    expect(getUnpauseErrorMessage(error)).toBe(
      'This organization needs attention: contact support',
    );
  });

  it('surfaces the Starter plan live-project limit', () => {
    const error = apolloError(
      'Starter plan can only have one project live at a time, please pause or delete your current free project and try again.',
    );

    expect(getUnpauseErrorMessage(error)).toBe(
      'Only one free project can be live at a time. Pause or delete your other free project first.',
    );
  });

  it('surfaces when the project is not currently paused', () => {
    const error = apolloError(
      'Cannot unpause project as it is not currently paused',
    );

    expect(getUnpauseErrorMessage(error)).toBe(
      'This project cannot be started until it is fully paused. Please try again shortly.',
    );
  });

  it('keeps locked projects outside the unpause mapping', () => {
    const error = apolloError('app is locked: Payment overdue');

    expect(getUnpauseErrorMessage(error)).toBe(
      'An error occurred while waking up the project. Please try again.',
    );
  });

  it('returns the generic message for unrelated errors', () => {
    const error = apolloError('database query error');

    expect(getUnpauseErrorMessage(error)).toBe(
      'An error occurred while waking up the project. Please try again.',
    );
  });
});
