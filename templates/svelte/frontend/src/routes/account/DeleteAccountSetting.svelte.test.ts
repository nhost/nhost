import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DeleteAccountSetting from './DeleteAccountSetting.svelte';

const goto = vi.hoisted(() => vi.fn());
const deleteAccount = vi.hoisted(() => vi.fn());

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('./actions.remote.ts', () => ({ deleteAccount }));

// The row's button and the dialog's share a name; this is the dialog's.
const confirmButton = (): HTMLButtonElement =>
  within(document.querySelector('dialog') as HTMLElement).getByRole('button', {
    name: 'Delete account',
  });

async function type(value: string): Promise<void> {
  await fireEvent.input(screen.getByLabelText(/to confirm/), {
    target: { value },
  });
}

describe('delete account setting', () => {
  beforeEach(async () => {
    goto.mockReset();
    deleteAccount.mockReset();
    render(DeleteAccountSetting);
    await fireEvent.click(
      screen.getByRole('button', { name: 'Delete account' }),
    );
  });

  it('waits for the word to be typed', async () => {
    expect(confirmButton().disabled).toBe(true);

    await type('delet');
    expect(confirmButton().disabled).toBe(true);
    await fireEvent.submit(confirmButton());
    expect(deleteAccount).not.toHaveBeenCalled();

    await type('delete');
    expect(confirmButton().disabled).toBe(false);
  });

  it('deletes once confirmed and leaves the page', async () => {
    deleteAccount.mockResolvedValueOnce({ success: true });

    await type('delete');
    await fireEvent.submit(confirmButton());

    expect(deleteAccount).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(goto).toHaveBeenCalledWith('/', { refreshAll: true }),
    );
  });
});
