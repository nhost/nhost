import { ApolloError } from '@apollo/client';
import { GraphQLError } from 'graphql';
import { toast } from 'react-hot-toast';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';
import execPromiseWithErrorToast from './execPromiseWithErrorToast';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const portError = new ApolloError({
  graphQLErrors: [new GraphQLError('The port value "302300" is out of range')],
});

const failWith = (error: Error) => () => Promise.reject(error);

afterEach(() => {
  toast.remove();
});

test('shows the server-provided error message over the generic message', async () => {
  render(<div />);

  await execPromiseWithErrorToast(failWith(portError), {
    loadingMessage: 'Updating the service...',
    successMessage: 'The service has been updated.',
    errorMessage:
      'An error occurred while updating the service. Please try again.',
  });

  expect(
    await screen.findByText(/The port value "302300" is out of range/i),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/An error occurred while updating the service/i),
  ).not.toBeInTheDocument();
});

test('shows the generic message for a network-only Apollo error', async () => {
  render(<div />);

  await execPromiseWithErrorToast(
    failWith(
      new ApolloError({ networkError: new TypeError('Failed to fetch') }),
    ),
    {
      loadingMessage: 'Updating the service...',
      successMessage: 'The service has been updated.',
      errorMessage:
        'An error occurred while updating the service. Please try again.',
    },
  );

  expect(
    await screen.findByText(/An error occurred while updating the service/i),
  ).toBeInTheDocument();
});

test('shows the resolved message when errorMessage is a function', async () => {
  render(<div />);

  await execPromiseWithErrorToast(failWith(portError), {
    loadingMessage: 'Starting the project...',
    successMessage: 'The project has been started.',
    errorMessage: () =>
      'Only one free project can be live at a time. Pause or delete your other free project first.',
  });

  expect(
    await screen.findByText(/Only one free project can be live at a time/i),
  ).toBeInTheDocument();
});

test('never shows the server message when errorMessage is a function', async () => {
  render(<div />);

  await execPromiseWithErrorToast(failWith(portError), {
    loadingMessage: 'Starting the project...',
    successMessage: 'The project has been started.',
    errorMessage: () =>
      'An error occurred while waking up the project. Please try again.',
  });

  expect(
    await screen.findByText(/An error occurred while waking up the project/i),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/The port value "302300" is out of range/i),
  ).not.toBeInTheDocument();
});
