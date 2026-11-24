import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMessage } from '../src/biome/parse.mts';
import { type BiomeResult, runBiome } from '../src/biome/runner.mts';

const dashboard = fileURLToPath(new URL('../..', import.meta.url));
const repository = fileURLToPath(new URL('../../..', import.meta.url));
const fixtureDir = fileURLToPath(new URL('./fixtures', import.meta.url));

export interface FixtureRun {
  report: BiomeResult;
  root: string;
  close: () => Promise<void>;
}

export async function fixtureRun(
  paths: string[],
  contents: ReadonlyMap<string, string> = new Map(),
  probe?: string,
): Promise<FixtureRun> {
  const root = await mkdtemp(join(tmpdir(), 'design-doctor-fixture-'));
  try {
    await mkdir(join(root, 'dashboard/src'), { recursive: true });
    await writeFile(join(root, '.gitignore'), '# fixture repository\n');
    await cp(join(repository, 'biome.json'), join(root, 'biome.json'));
    for (const file of ['biome.json', 'biome.design.json']) {
      await cp(join(dashboard, file), join(root, 'dashboard', file));
    }
    for (const [source, target, file] of [
      [repository, root, 'biome.json'],
      [dashboard, join(root, 'dashboard'), 'biome.json'],
      [dashboard, join(root, 'dashboard'), 'biome.design.json'],
    ]) {
      const config = JSON.parse(await readFile(join(source, file), 'utf8')) as {
        plugins?: { path: string }[];
      };
      for (const plugin of config.plugins ?? []) {
        const directory = plugin.path.split('/').slice(0, -1).join('/');
        await cp(join(source, directory), join(target, directory), {
          recursive: true,
        });
      }
    }
    if (probe) {
      const configPath = join(root, 'dashboard/biome.design.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as {
        plugins: { path: string; includes: string[] }[];
      };
      const scope = config.plugins[0]?.includes;
      if (!scope) {
        throw new Error('Fixture config has no design plugin scope');
      }
      config.plugins.push({ path: './probe.grit', includes: scope });
      await writeFile(configPath, JSON.stringify(config));
      await writeFile(join(root, 'dashboard/probe.grit'), probe);
    }
    for (const path of paths) {
      const dest = join(root, 'dashboard/src', path);
      await mkdir(join(dest, '..'), { recursive: true });
      if (contents.has(path)) {
        await writeFile(dest, contents.get(path) ?? '');
      } else {
        await cp(join(fixtureDir, path), dest);
      }
    }
    const report = await runBiome(
      join(root, 'dashboard'),
      paths.map((path) => `src/${path}`),
    );
    for (const path of paths) {
      const text = await readFile(join(root, 'dashboard/src', path), 'utf8');
      const expected: string[] = [];
      let pending: string[] = [];
      const lines = text.split(/\r\n|\r|\n/);
      for (const [index, line] of lines.entries()) {
        const annotation =
          /(?:\/\/ expect: ([a-z-]+) "([^"]+)"|\{\/\* expect: ([a-z-]+) "([^"]+)" \*\/\})\s*$/.exec(
            line,
          );
        if (
          line.includes('expect:') &&
          (!annotation || line.slice(0, annotation.index).includes('expect:'))
        ) {
          throw new Error(`${path}:${index + 1}: malformed expect annotation`);
        }
        if (annotation && !line.slice(0, annotation.index).trim()) {
          pending.push(
            `${annotation[1] ?? annotation[3]}:${annotation[2] ?? annotation[4]}`,
          );
          continue;
        }
        if (pending.length) {
          if (!line.trim()) {
            throw new Error(
              lines.slice(index + 1).every((remaining) => !remaining.trim())
                ? `${path}: expect block has no following code`
                : `${path}:${index + 1}: expect block must immediately precede code`,
            );
          }
          if (/^\s*(?:\/\/|\/\*|\{\/\*)/.test(line)) {
            throw new Error(
              `${path}:${index + 1}: non-expect comment inside expect block`,
            );
          }
          expected.push(...pending.map((entry) => `${index + 1}:${entry}`));
          pending = [];
        }
        if (annotation) {
          expected.push(
            `${index + 1}:${annotation[1] ?? annotation[3]}:${annotation[2] ?? annotation[4]}`,
          );
        }
      }
      if (pending.length) {
        throw new Error(`${path}: expect block has no following code`);
      }
      const fileDiagnostics = report.diagnostics.filter(
        (entry) => entry.location.path === `src/${path}`,
      );
      const actual = fileDiagnostics.flatMap((entry) => {
        const parsed = parseMessage(entry.message);
        if (!parsed) {
          return [];
        }
        if (entry.severity !== 'warning') {
          throw new Error(`${path}: ${parsed.ruleId} is not a warning`);
        }
        return parsed.subjects.map(
          ({ subject }) =>
            `${entry.location.start.line}:${parsed.ruleId}:${subject}`,
        );
      });
      if (JSON.stringify(actual.sort()) !== JSON.stringify(expected.sort())) {
        throw new Error(
          `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}; diagnostics: ${JSON.stringify(report.diagnostics.filter((entry) => entry.location.path === `src/${path}`).map((entry) => entry.message))}`,
        );
      }
    }
    return {
      report,
      root,
      close: () => rm(root, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
