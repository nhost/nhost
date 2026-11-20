import { bounded, first, TIMED_OUT } from '@/lib/utils';

describe('first', () => {
  it('reads a repeated param as its first value', () => {
    expect(first('a')).toBe('a');
    expect(first(['a', 'b'])).toBe('a');
    expect(first([])).toBeUndefined();
    expect(first(undefined)).toBeUndefined();
  });
});

describe('bounded', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('passes on what settles in time', async () => {
    await expect(bounded(Promise.resolve('value'), 10)).resolves.toBe('value');
    await expect(
      bounded(Promise.reject(new Error('failed')), 10),
    ).rejects.toThrow('failed');
  });

  it('gives up once the time is up', async () => {
    jest.useFakeTimers();
    const result = bounded(new Promise(() => undefined), 10_000);

    jest.advanceTimersByTime(10_000);

    await expect(result).resolves.toBe(TIMED_OUT);
  });
});
