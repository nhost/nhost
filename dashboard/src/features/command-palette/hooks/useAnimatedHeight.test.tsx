import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAnimatedHeight } from './useAnimatedHeight';

const setReducedMotion = (matches: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
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
