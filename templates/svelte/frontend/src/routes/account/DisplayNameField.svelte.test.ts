import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayNameField from './DisplayNameField.svelte';

const refreshAll = vi.hoisted(() => vi.fn());
const updateDisplayName = vi.hoisted(() => vi.fn());

vi.mock('$app/navigation', () => ({ refreshAll }));
vi.mock('./actions.remote.ts', () => ({ updateDisplayName }));

describe('display name field', () => {
  beforeEach(() => {
    refreshAll.mockReset();
    updateDisplayName.mockReset();
  });

  it('saves the new name, closes and loads the page again', async () => {
    updateDisplayName.mockResolvedValueOnce({ success: true });
    const { container } = render(DisplayNameField, {
      props: { displayName: 'Ada' },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Edit name' }));
    await fireEvent.input(screen.getByLabelText('Display name'), {
      target: { value: 'Ada Lovelace' },
    });
    await fireEvent.submit(screen.getByRole('button', { name: 'Save' }));

    expect(updateDisplayName).toHaveBeenCalledWith('Ada Lovelace');
    await vi.waitFor(() => expect(container.querySelector('form')).toBeNull());
    expect(refreshAll).toHaveBeenCalled();
  });

  it('starts each edit from the saved name', async () => {
    render(DisplayNameField, { props: { displayName: 'Ada' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Edit name' }));
    await fireEvent.input(screen.getByLabelText('Display name'), {
      target: { value: 'Grace' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Edit name' }));

    expect(
      (screen.getByLabelText('Display name') as HTMLInputElement).value,
    ).toBe('Ada');
  });
});
