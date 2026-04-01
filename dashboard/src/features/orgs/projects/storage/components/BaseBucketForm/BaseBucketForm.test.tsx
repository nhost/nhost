import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@/tests/testUtils';
import BaseBucketForm from './BaseBucketForm';

describe('BaseBucketForm', () => {
  it('should render all form fields', () => {
    render(<BaseBucketForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Min Upload File Size (bytes)'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Max Upload File Size (bytes)'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Download Expiration (seconds)'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Cache Control')).toBeInTheDocument();
    expect(screen.getByLabelText('Presigned URLs Enabled')).toBeInTheDocument();
  });

  it('should call onSubmit with form values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BaseBucketForm onSubmit={onSubmit} />);

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'test-bucket');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-bucket',
          minUploadFileSize: 1,
          maxUploadFileSize: 50000000,
          presignedUrlsEnabled: true,
          downloadExpiration: 30,
          cacheControl: 'max-age=3600',
        }),
        expect.anything(),
      );
    });
  });

  it('should show validation error when name is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BaseBucketForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Bucket name is required')).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should show validation error when max upload size is less than min', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BaseBucketForm onSubmit={onSubmit} />);

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'test-bucket');

    await user.clear(screen.getByLabelText('Min Upload File Size (bytes)'));
    await user.type(
      screen.getByLabelText('Min Upload File Size (bytes)'),
      '1000',
    );

    await user.clear(screen.getByLabelText('Max Upload File Size (bytes)'));
    await user.type(
      screen.getByLabelText('Max Upload File Size (bytes)'),
      '500',
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Must be greater than or equal to min upload file size',
        ),
      ).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
