import { ApolloError } from '@apollo/client';
import { GraphQLError } from 'graphql';
import { getCreateProjectErrorMessage } from '@/features/orgs/utils/getCreateProjectErrorMessage';

function apolloError(message: string, extensions?: Record<string, unknown>) {
  return new ApolloError({
    graphQLErrors: [new GraphQLError(message, { extensions })],
  });
}

describe('getCreateProjectErrorMessage', () => {
  it('surfaces when the organization needs attention', () => {
    const error = apolloError('database query error', {
      internal: {
        error: {
          message: 'organization needs attention: contact support',
        },
      },
    });

    expect(getCreateProjectErrorMessage(error)).toBe(
      'This organization needs attention: contact support',
    );
  });

  it('surfaces the Starter plan live-project limit', () => {
    const error = apolloError(
      'Starter plan can only have one project live at a time, please pause or delete your current free project and try again.',
    );

    expect(getCreateProjectErrorMessage(error)).toBe(
      'Your free organization already has a live project. Pause or delete it before creating another.',
    );
  });

  it('surfaces when the selected region is not permitted', () => {
    const error = apolloError(
      'Selected region is not permitted in this organization',
    );

    expect(getCreateProjectErrorMessage(error)).toBe(
      'The selected region is not available for this organization. Choose a different region.',
    );
  });

  it('returns the generic message for unrelated errors', () => {
    const error = apolloError('database query error');

    expect(getCreateProjectErrorMessage(error)).toBe(
      'An error occurred while creating the project. Please try again.',
    );
  });
});
