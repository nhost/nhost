import { vi } from 'vitest';
import executeWithLoadingState from './execute-with-loading-state';

describe('executeWithLoadingState', () => {
  it('resets loading after a handled failure so the operation can be retried', async () => {
    const operation = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(undefined);
    const setLoading = vi.fn<(loading: boolean) => void>();

    await executeWithLoadingState(operation, setLoading);
    await executeWithLoadingState(operation, setLoading);

    expect(operation).toHaveBeenCalledTimes(2);
    expect(setLoading.mock.calls).toEqual([[true], [false], [true], [false]]);
  });

  it('resets loading when the operation throws unexpectedly', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('unexpected'));
    const setLoading = vi.fn<(loading: boolean) => void>();

    await expect(
      executeWithLoadingState(operation, setLoading),
    ).rejects.toThrow('unexpected');
    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });
});
