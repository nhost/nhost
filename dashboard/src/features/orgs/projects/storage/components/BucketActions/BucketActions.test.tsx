import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { render, screen } from '@/tests/testUtils';
import BucketActions from './BucketActions';

describe('BucketActions', () => {
  it('should call onEdit when Edit Bucket is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<BucketActions onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Edit Bucket'));

    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('should call onDelete when Delete Bucket is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<BucketActions onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Delete Bucket'));

    expect(onDelete).toHaveBeenCalledOnce();
  });
});
