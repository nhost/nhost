// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayNameField from '@/app/account/DisplayNameField.vue';
import {
  buttonIn,
  click,
  inputFor,
  type Mounted,
  mountAt,
  submit,
  typeIn,
} from '@/test/mount';

const refresh = vi.hoisted(() => vi.fn());
const updateDisplayName = vi.hoisted(() => vi.fn());

vi.mock('@/components/useRefresh', () => ({ useRefresh: () => refresh }));
vi.mock('@/app/account/actions', () => ({ updateDisplayName }));

let mounted: Mounted;

describe('display name field', () => {
  beforeEach(async () => {
    refresh.mockReset();
    updateDisplayName.mockReset();
    mounted = await mountAt(DisplayNameField, '/', {
      props: { displayName: 'Ada' },
    });
  });

  it('saves the new name, closes and loads the page again', async () => {
    updateDisplayName.mockResolvedValueOnce({ success: true });
    await click(buttonIn(mounted.el, 'Edit name'));
    await typeIn(inputFor(mounted.el, 'Display name'), 'Ada Lovelace');

    await submit(mounted.el.querySelector('form'));

    expect(updateDisplayName).toHaveBeenCalledWith('Ada Lovelace');
    expect(mounted.el.querySelector('form')).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });
});
