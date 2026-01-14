import { test } from 'vitest';
import { render, screen } from '@/tests/testUtils';
import ErrorToast from './ErrorToast';

const runUpdateError = {
  name: 'ApolloError',
  graphQLErrors: [
    {
      message: 'The port value "302300" is out of range',
      path: ['replaceRunServiceConfig', 'config', 'ports', 0, 'port'],
    },
  ],
  protocolErrors: [],
  clientErrors: [],
  networkError: null,
  message:
    'problem trying to parse string: strconv.ParseInt: parsing "302300": value out of range',
  cause: {
    message:
      'problem trying to parse string: strconv.ParseInt: parsing "302300": value out of range',
    path: ['replaceRunServiceConfig', 'config', 'ports', 0, 'port'],
  },
};

test('should render the available Apollo error message but not the fallback message', () => {
  const fallbackErrorMessage =
    'An error occurred while updating the service. Please try again.';
  render(
    <ErrorToast
      isVisible
      errorMessage={fallbackErrorMessage}
      error={runUpdateError}
      close={() => {}}
    />,
  );

  expect(screen.queryByText(fallbackErrorMessage)).not.toBeInTheDocument();

  expect(
    screen.getByText(/The port value "302300" is out of range/i),
  ).toBeInTheDocument();
});
