import ErrorToast from '@/features/orgs/utils/execPromiseWithErrorToast/ErrorToast';
import { render, screen } from '@/tests/testUtils';

it('should render the provided error message', () => {
  const errorMessage =
    'An error occurred while updating the service. Please try again.';
  render(
    <ErrorToast
      toastId="update-service-error"
      errorMessage={errorMessage}
      error={
        new Error('strconv.ParseInt: parsing "302300": value out of range')
      }
    />,
  );

  expect(screen.getByText(errorMessage)).toBeInTheDocument();
});

it('should render the fallback text when the message is empty', () => {
  render(
    <ErrorToast toastId="empty-error" errorMessage="" error={new Error()} />,
  );

  expect(
    screen.getByText('An unknown error has occurred, please try again later!'),
  ).toBeInTheDocument();
});

it('should render the metadata conflict toast for a metadata conflict error', () => {
  render(
    <ErrorToast
      toastId="metadata-conflict"
      errorMessage="Could not save changes"
      error={
        new Error(
          'metadata resource version referenced (70) did not match current version',
        )
      }
    />,
  );

  expect(
    screen.getByRole('heading', { name: 'Metadata is out of date' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('Could not save changes')).not.toBeInTheDocument();
});
