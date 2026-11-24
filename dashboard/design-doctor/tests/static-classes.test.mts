import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runBiome } from '../src/biome/runner.mts';
import { fixtureRun } from './harness.mts';

it('reports glued interpolation and opaque design-system classes but permits forwarded and static values', async () => {
  const run = await fixtureRun(['features/static-classes.tsx']);
  try {
    const dashboard = join(run.root, 'dashboard');
    const path = 'src/features/static-classes.tsx';
    const file = join(dashboard, path);
    const formatted = execFileSync(
      'biome',
      ['format', `--stdin-file-path=${path}`],
      { cwd: dashboard, input: await readFile(file), encoding: 'utf8' },
    );
    await writeFile(file, formatted);
    const result = await runBiome(dashboard, [path]);
    expect(
      result.diagnostics.some((entry) =>
        entry.message.includes(
          'Input getButtonStyles({variant,size,disabled,}).root',
        ),
      ),
    ).toBe(true);
  } finally {
    await run.close();
  }
}, 15000);
