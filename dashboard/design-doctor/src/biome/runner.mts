import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMessage } from './parse.mts';

export interface BiomeDiagnostic {
  category: string;
  severity: string;
  message: string;
  location: {
    path: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}
export interface BiomeResult {
  diagnostics: BiomeDiagnostic[];
  summary: {
    errors: number;
    warnings: number;
    diagnosticsNotPrinted: number;
  };
  exitCode: number;
}

async function biomeCommand(
  args: string[],
  dashboard: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((finish, fail) => {
    const child = spawn(
      'biome',
      [
        'check',
        '--config-path=biome.design.json',
        '--max-diagnostics=none',
        ...args,
      ],
      { cwd: resolve(dashboard) },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', fail);
    child.on('close', (code) => finish({ stdout, stderr, code }));
  });
}

export async function runBiome(
  dashboard = fileURLToPath(new URL('../../..', import.meta.url)),
  paths?: string[],
): Promise<BiomeResult> {
  const result = await biomeCommand(
    ['--reporter=json', ...(paths ?? [])],
    dashboard,
  );
  return parseBiomeReport(result.stdout, result.stderr, result.code);
}

// JSON diagnostics omit clean files; one run writes JSON to a file and its
// verbose summary (including the processed inventory) to stdout.
export async function runBiomeWithInventory(
  dashboard: string,
  paths?: string[],
): Promise<{ result: BiomeResult; processed: string[] }> {
  if (paths?.length === 0) {
    return {
      result: {
        diagnostics: [],
        summary: { errors: 0, warnings: 0, diagnosticsNotPrinted: 0 },
        exitCode: 0,
      },
      processed: [],
    };
  }
  if (paths && (paths.length > 128 || paths.join('').length > 24000)) {
    const chunks: string[][] = [];
    let chunk: string[] = [];
    for (const path of paths) {
      if (
        chunk.length &&
        (chunk.length >= 128 || [...chunk, path].join('').length > 24000)
      ) {
        chunks.push(chunk);
        chunk = [];
      }
      chunk.push(path);
    }
    if (chunk.length) {
      chunks.push(chunk);
    }
    const runs: Awaited<ReturnType<typeof runBiomeWithInventory>>[] = [];
    for (let index = 0; index < chunks.length; index += 2) {
      runs.push(
        ...(await Promise.all(
          chunks
            .slice(index, index + 2)
            .map((part) => runBiomeWithInventory(dashboard, part)),
        )),
      );
    }
    return {
      result: {
        diagnostics: runs.flatMap(({ result }) => result.diagnostics),
        summary: {
          errors: runs.reduce(
            (total, { result }) => total + result.summary.errors,
            0,
          ),
          warnings: runs.reduce(
            (total, { result }) => total + result.summary.warnings,
            0,
          ),
          diagnosticsNotPrinted: 0,
        },
        exitCode: runs.some(({ result }) => result.exitCode === 1) ? 1 : 0,
      },
      processed: runs.flatMap(({ processed }) => processed),
    };
  }
  const temporary = await mkdtemp(join(tmpdir(), 'design-doctor-biome-'));
  try {
    const report = join(temporary, 'report.json');
    const output = await biomeCommand(
      [
        '--verbose',
        '--reporter=summary',
        '--reporter=json',
        `--reporter-file=${report}`,
        ...(paths ?? []),
      ],
      dashboard,
    );
    let json: string;
    try {
      json = await readFile(report, 'utf8');
    } catch (error) {
      throw new Error(
        `Biome reporter contract failed: JSON file unreadable (exit ${output.code}): ${output.stderr}`,
        { cause: error },
      );
    }
    const result = parseBiomeReport(json, output.stderr, output.code);
    return { result, processed: parseProcessedFiles(output.stdout) };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export function parseProcessedFiles(text: string): string[] {
  const match =
    / {2}i Files processed:\s*\n([\s\S]*?)(?=\n VERBOSE |\nScanned project folder)/.exec(
      text,
    );
  if (!match) {
    throw new Error('Biome verbose file inventory contract failed');
  }
  const files = match[1]
    .split('\n')
    .filter((line) => line.startsWith('  - '))
    .map((line) => line.slice(4));
  if (!files.length && !match[1].includes('The list is empty')) {
    throw new Error('Biome verbose file inventory contract failed');
  }
  return files;
}

export function parseBiomeReport(
  stdout: string,
  stderr: string,
  code: number | null,
): BiomeResult {
  let report: Omit<BiomeResult, 'exitCode'>;
  try {
    report = JSON.parse(stdout) as Omit<BiomeResult, 'exitCode'>;
  } catch {
    throw new Error(`Biome did not return JSON (exit ${code}): ${stderr}`);
  }
  if (
    (code !== 0 && code !== 1) ||
    !Array.isArray(report.diagnostics) ||
    !report.summary ||
    report.summary.diagnosticsNotPrinted !== 0
  ) {
    throw new Error(`Biome reporter contract failed (exit ${code}): ${stderr}`);
  }
  for (const diagnostic of report.diagnostics) {
    if (diagnostic.category !== 'plugin') {
      continue;
    }
    // Biome 2.5.11 can put a Grit compilation failure in a valid JSON report
    // as an info-level plugin diagnostic, even while returning exit code zero.
    if (diagnostic.message.includes(' errored:')) {
      throw new Error(`Biome plugin failed: ${diagnostic.message}`);
    }
    if (
      diagnostic.message.startsWith('[design/') &&
      !parseMessage(diagnostic.message)
    ) {
      throw new Error(`Invalid design diagnostic: ${diagnostic.message}`);
    }
  }
  return { ...report, exitCode: code };
}
