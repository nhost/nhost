import { render, screen } from '@/tests/testUtils';
import { test } from 'vitest';
import ErrorToast from './ErrorToast';

const oneMemberByWorkspaceError = {
  name: 'ApolloError',
  graphQLErrors: [
    {
      message: 'database query error',
      extensions: {
        path: '$.selectionSet.insertApp.args.object',
        code: 'unexpected',
        internal: {
          arguments: [],
          error: {
            description: null,
            exec_status: 'FatalError',
            hint: null,
            message:
              'Only one workspace member is allowed for individual plans',
            status_code: 'P0001',
          },
          prepared: false,
          statement: '.....',
        },
      },
    },
  ],
  protocolErrors: [],
  clientErrors: [],
  networkError: null,
  message: 'database query error',
};

const changeNodeInvalidVersionError = {
  name: 'ApolloError',
  graphQLErrors: [
    {
      message:
        'failed to resolve config: failed to validate config: config is not valid: #Config.functions.node.version: 2 errors in empty disjunction: (and 2 more errors)',
      path: ['replaceConfigRawJSON'],
    },
  ],
  protocolErrors: [],
  clientErrors: [],
  networkError: null,
  message:
    'failed to resolve config: failed to validate config: config is not valid: #Config.functions.node.version: 2 errors in empty disjunction: (and 2 more errors)',
};

test('should render the error message when creating a project with an individual plan in a workspace with multiple users', () => {
  const errorMessage =
    'An error occurred while creating the project. Please try again.';
  render(
    <ErrorToast
      isVisible
      errorMessage={errorMessage}
      error={oneMemberByWorkspaceError}
      close={() => {}}
    />,
  );

  expect(
    screen.getByText(
      /Only one workspace member is allowed for individual plans/i,
    ),
  ).toBeInTheDocument();
});

test('should render the error message when changing the node version to an invalid value in configuration editor', () => {
  const errorMessage =
    'An error occurred while saving configuration. Please try again.';
  render(
    <ErrorToast
      isVisible
      errorMessage={errorMessage}
      error={changeNodeInvalidVersionError}
      close={() => {}}
    />,
  );
  const regex =
    /failed to resolve config: failed to validate config: config is not valid: #Config\.functions\.node\.version: 2 errors in empty disjunction: \(and 2 more errors\)/i;

  expect(screen.getByText(regex)).toBeInTheDocument();
});
