// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DeleteAccountSetting from '@/app/account/DeleteAccountSetting.vue';
import { click, type Mounted, mountAt, submit, typeIn } from '@/test/mount';

const deleteAccount = vi.hoisted(() => vi.fn());

vi.mock('@/app/account/actions', () => ({ deleteAccount }));

let mounted: Mounted;

const dialog = (): HTMLDialogElement | null =>
  mounted.el.querySelector('dialog');

const confirmButton = (): HTMLButtonElement | null =>
  dialog()?.querySelector('button[type="submit"]') ?? null;

const open = () => click(mounted.el.querySelector<HTMLElement>('li > button'));

const type = (value: string) => typeIn(dialog()?.querySelector('input'), value);

describe('delete account setting', () => {
  beforeEach(async () => {
    deleteAccount.mockReset();
    mounted = await mountAt(DeleteAccountSetting, '/account');
  });

  it('waits for the word to be typed', async () => {
    await open();
    expect(confirmButton()?.disabled).toBe(true);

    await type('delet');
    expect(confirmButton()?.disabled).toBe(true);
    await submit(dialog()?.querySelector('form'));
    expect(deleteAccount).not.toHaveBeenCalled();

    await type('delete');
    expect(confirmButton()?.disabled).toBe(false);
  });

  it('deletes once confirmed and leaves the page', async () => {
    deleteAccount.mockResolvedValueOnce({ success: true });

    await open();
    await type('delete');
    await submit(dialog()?.querySelector('form'));

    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(mounted.router.currentRoute.value.path).toBe('/');
  });
});
