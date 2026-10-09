import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useIntent } from '@/signin/useIntent';

function Probe() {
  return useIntent();
}

function intentAt(location: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[location]}>
      <Probe />
    </MemoryRouter>,
  );
}

describe('useIntent', () => {
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
