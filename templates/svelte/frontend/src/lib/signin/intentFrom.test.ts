import { describe, expect, it, vi } from 'vitest';
import { pageIntent } from '$lib/signin/intentFrom';

const page = vi.hoisted(() => ({ url: new URL('http://localhost/') }));

vi.mock('$app/state', () => ({ page }));

function intentAt(location: string): string {
  page.url = new URL(location, 'http://localhost');

  return pageIntent();
}

describe('pageIntent', () => {
  it('reads the intent the link asked for', () => {
    expect(intentAt('/signin?intent=sign-in')).toBe('sign-in');
  });

  it('signs up without a value', () => {
    expect(intentAt('/signin')).toBe('sign-up');
    expect(intentAt('/signin?intent')).toBe('sign-up');
  });

  it('reads only the first of a repeated parameter', () => {
    expect(intentAt('/signin?intent=sign-in&intent=sign-up')).toBe('sign-in');
  });
});
