// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChangeEmailForm from '@/app/account/ChangeEmailForm.vue';
import { inputFor, mountAt, submit, textOf, typeIn } from '@/test/mount';

const actions = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock('@/app/account/actions', () => actions);

const render = async (verified: boolean) =>
  (
    await mountAt(ChangeEmailForm, '/', {
      props: { email: 'user@example.com', verified },
    })
  ).el;

describe('change email form', () => {
  beforeEach(() => {
    actions.changeEmail.mockReset();
    actions.resendVerification.mockReset();
  });

  it('starts the change and says where the link went', async () => {
    actions.changeEmail.mockResolvedValueOnce({ success: true });
    const el = await render(true);
    await typeIn(inputFor(el, 'New email'), 'new@example.com');

    await submit(el.querySelector('form'));

    expect(actions.changeEmail).toHaveBeenCalledWith('new@example.com');
    expect(textOf(el, 'status')).toContain(
      'confirmation link to new@example.com',
    );
    expect(textOf(el, 'status')).toContain('changes when you open it');
  });
});
