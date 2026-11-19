// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OtpForm from '@/app/auth/otp/OtpForm';

const actions = vi.hoisted(() => ({
  sendCode: vi.fn(),
  verifyCode: vi.fn(),
}));

vi.mock('@/app/auth/otp/actions', () => actions);

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let path = '';

function Where() {
  path = useLocation().pathname;
  return null;
}

async function render(sentTo?: string): Promise<void> {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/auth/otp']}>
        <OtpForm next="/account" sentTo={sentTo} />
        <Where />
      </MemoryRouter>,
    ),
  );
}

async function type(name: string, value: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>(
    `input[name="${name}"]`,
  );
  if (!input) {
    throw new Error(`no ${name} input`);
  }
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  if (!button) {
    throw new Error(`no ${label} button`);
  }
  await act(async () => button.click());
}

describe('email code form', () => {
  beforeEach(() => {
    actions.sendCode.mockReset();
    actions.verifyCode.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // Arriving from the code email, sending again would replace the code it
  // holds.
  it('takes a code already sent without sending another', async () => {
    await render();
    await type('email', 'user@example.com');

    await click('I already have a code');

    expect(actions.sendCode).not.toHaveBeenCalled();
    expect(container.querySelector('input[name="otp"]')).not.toBeNull();
    expect(container.textContent).toContain(
      'Enter the code from the most recent email we sent to user@example.com.',
    );
  });

  it('says earlier codes stop working once a new one is sent', async () => {
    actions.sendCode.mockResolvedValue({ success: true });
    await render('user@example.com');
    expect(container.textContent).toContain(
      'We sent a code to user@example.com.',
    );

    await click('Send a new code');

    expect(actions.sendCode).toHaveBeenCalledWith(
      'user@example.com',
      '/account',
    );
    expect(container.textContent).toContain(
      'We sent a new code to user@example.com. Codes from earlier emails no longer work.',
    );
  });

  it('signs in with the right code after a wrong one', async () => {
    actions.verifyCode
      .mockResolvedValueOnce({ error: 'That code did not work.' })
      .mockResolvedValueOnce({ success: true });
    await render('user@example.com');

    await type('otp', '111111');
    await click('Sign in');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'That code did not work.',
    );

    await type('otp', '222222');
    await click('Sign in');

    expect(actions.verifyCode).toHaveBeenLastCalledWith(
      'user@example.com',
      '222222',
    );
    expect(path).toBe('/account');
  });

  // The input's numeric pattern would block the submit otherwise.
  it('drops the spaces from a pasted code', async () => {
    await render('user@example.com');

    await type('otp', ' 123 456\n');

    expect(
      container.querySelector<HTMLInputElement>('input[name="otp"]')?.value,
    ).toBe('123456');
  });
});
