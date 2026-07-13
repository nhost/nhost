import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import { renderHook } from '@/tests/testUtils';

import { useAnimatedHeight } from './useAnimatedHeight';

const setReducedMotion = (matches: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    ...mockMatchMediaValue(query),
    matches,
  }));
};

describe('useAnimatedHeight', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leaves height undefined and disables animation when measurement is zero', () => {
    setReducedMotion(false);

    const { result } = renderHook(() => useAnimatedHeight<HTMLDivElement>());

    expect(result.current.height).toBeUndefined();
    expect(result.current.animate).toBe(false);
  });

  it('disables animation under reduced motion', () => {
    setReducedMotion(true);

    const { result } = renderHook(() => useAnimatedHeight<HTMLDivElement>());

    expect(result.current.animate).toBe(false);
  });
});
