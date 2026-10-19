import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PasswordRequirements from '@/app/auth/password/PasswordRequirements';
import { PASSWORD_MIN_LENGTH } from '@/app/auth/password/requirements';

const render = (password: string, confirm?: string): string =>
  renderToStaticMarkup(
    <PasswordRequirements id="rules" password={password} confirm={confirm} />,
  );

const long = 'a'.repeat(PASSWORD_MIN_LENGTH);

describe('PasswordRequirements', () => {
  it('lists the rules with the length the backend wants', () => {
    expect(render('')).toContain(`At least ${PASSWORD_MIN_LENGTH} characters`);
  });

  // The tick is decoration, so the state is in words too. Without it a
  // screen reader hears the rules and nothing about meeting them.
  it('says met or not met in text, not only as a mark', () => {
    expect(render('')).toContain('not met');
    expect(render(long)).toContain('met');
    expect(render(long)).not.toContain('not met');
  });

  it('carries the id the fields point at with aria-describedby', () => {
    expect(render('')).toContain('id="rules"');
  });

  it('drops the match rule when there is no second field', () => {
    expect(render(long)).not.toContain('Both entries match');
    expect(render(long, long)).toContain('Both entries match');
  });
});
