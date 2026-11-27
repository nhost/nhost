import { type LockMode, ProcessLockManager } from '@/lib/locks';

// A callback that holds the lock until the test lets it go.
function holder(log: string[], label: string) {
  let release: VoidFunction = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const callback = async () => {
    log.push(`${label} start`);
    await held;
    log.push(`${label} end`);
    return label;
  };
  return { callback, release };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ProcessLockManager', () => {
  it('runs exclusive requests one at a time, in order', async () => {
    const locks = new ProcessLockManager();
    const log: string[] = [];
    const [a, b, c] = ['a', 'b', 'c'].map((label) => holder(log, label));

    const results = [a, b, c].map(({ callback }) =>
      locks.request('lock', { mode: 'exclusive' }, callback),
    );
    await settle();
    expect(log).toEqual(['a start']);

    a.release();
    await settle();
    expect(log).toEqual(['a start', 'a end', 'b start']);

    b.release();
    c.release();
    expect(await Promise.all(results)).toEqual(['a', 'b', 'c']);
    expect(log).toEqual([
      'a start',
      'a end',
      'b start',
      'b end',
      'c start',
      'c end',
    ]);
  });

  it('runs shared requests together, and an exclusive one alone', async () => {
    const locks = new ProcessLockManager();
    const log: string[] = [];
    const modes: [string, LockMode][] = [
      ['s1', 'shared'],
      ['s2', 'shared'],
      ['x', 'exclusive'],
      ['s3', 'shared'],
    ];
    const holders = modes.map(([label, mode]) => {
      const h = holder(log, label);
      return { ...h, done: locks.request('lock', { mode }, h.callback) };
    });
    const [s1, s2, x, s3] = holders;

    await settle();
    expect(log).toEqual(['s1 start', 's2 start']);

    // A shared request behind a waiting exclusive one waits too.
    s1.release();
    await settle();
    expect(log).toEqual(['s1 start', 's2 start', 's1 end']);

    s2.release();
    await settle();
    expect(log.slice(-2)).toEqual(['s2 end', 'x start']);

    x.release();
    await settle();
    expect(log.slice(-2)).toEqual(['x end', 's3 start']);

    s3.release();
    await Promise.all(holders.map(({ done }) => done));
  });

  it('keeps names apart', async () => {
    const locks = new ProcessLockManager();
    const log: string[] = [];
    const a = holder(log, 'a');
    const b = holder(log, 'b');

    const done = [
      locks.request('one', { mode: 'exclusive' }, a.callback),
      locks.request('two', { mode: 'exclusive' }, b.callback),
    ];
    await settle();
    expect(log).toEqual(['a start', 'b start']);

    a.release();
    b.release();
    await Promise.all(done);
  });

  it('releases the lock when the callback throws', async () => {
    const locks = new ProcessLockManager();

    await expect(
      locks.request('lock', { mode: 'exclusive' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(
      locks.request('lock', { mode: 'exclusive' }, () => 'next'),
    ).resolves.toBe('next');
  });

  it('is navigator.locks', () => {
    expect(navigator.locks).toBeInstanceOf(ProcessLockManager);
  });
});
