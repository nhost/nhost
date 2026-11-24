#!/usr/bin/env node
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    'Design doctor requires Node >= 22.18 (native TypeScript type stripping).',
  );
  process.exitCode = 2;
} else {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'generate') {
      if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
        throw new Error('Usage: pnpm design-doctor generate [--check]');
      }
      const { generate } = await import('./src/tokens/generate.mts');
      const drift = await generate(args[0] === '--check');
      if (drift.length) {
        console.error(`Generated artifact drift: ${drift.join(', ')}`);
        process.exitCode = 1;
      }
    } else if (command === 'explain') {
      if (args.length !== 1) {
        throw new Error('Usage: pnpm design-doctor explain <rule-id>');
      }
      const { loadManifest } = await import('./src/grit/manifest.mts');
      const manifest = await loadManifest();
      const rule = manifest.rules.find(({ id }) => id === args[0]);
      if (!rule) {
        throw new Error(`Unknown design rule: ${args[0]}`);
      }
      const { readFile } = await import('node:fs/promises');
      process.stdout.write(
        await readFile(
          new URL(rule.docs.replace('design-doctor/', './'), import.meta.url),
          'utf8',
        ),
      );
    } else {
      const options = process.argv.slice(2);
      const action = options[0] === 'baseline' ? options.splice(0, 2) : [];
      let json = false;
      let markdown = false;
      let out;
      let base;
      let check = false;
      let changed = false;
      const seeds = [];
      let move;
      if (action.length && !['update', 'move'].includes(action[1])) {
        throw new Error(
          'Usage: pnpm design-doctor baseline update [--seed <rule>] | baseline move <old> <new>',
        );
      }
      if (action[1] === 'move') {
        if (options.length !== 2) {
          throw new Error(
            'Usage: pnpm design-doctor baseline move <old> <new>',
          );
        }
        move = options.splice(0, 2);
      }
      while (options.length) {
        const arg = options.shift();
        if (arg === '--json') {
          json = true;
        } else if (arg === '--markdown') {
          markdown = true;
        } else if (arg === '--check') {
          check = true;
        } else if (arg === '--changed') {
          changed = true;
        } else if (arg === '--base' || arg === '--out' || arg === '--seed') {
          const value = options.shift();
          if (!value || value.startsWith('--')) {
            throw new Error(`Missing value for ${arg}`);
          }
          if (arg === '--base') {
            base = value;
          }
          if (arg === '--out') {
            out = value;
          }
          if (arg === '--seed') {
            seeds.push(value);
          }
        } else {
          throw new Error(`Unknown option: ${arg}`);
        }
      }
      if (
        (json && markdown) ||
        (out && !json) ||
        (changed && !base) ||
        (seeds.length && action[1] !== 'update') ||
        (action.length && (json || markdown || changed || check || out || base))
      ) {
        throw new Error(
          'Usage: pnpm design-doctor [--json [--out <path>] | --markdown] [--check] [--changed --base <ref>] | baseline update [--seed <rule>] | baseline move <old> <new>',
        );
      }
      const { runDoctor } = await import('./src/doctor/run.mts');
      const { formatText, formatMarkdown } = await import(
        './src/doctor/format.mts'
      );
      const { report, warnings, failed } = await runDoctor(undefined, {
        changed,
        base,
        check,
        update: action[1] === 'update',
        seeds,
        move,
      });
      for (const warning of warnings) {
        console.error(`Warning: ${warning}`);
      }
      let output = formatText(report);
      if (json) {
        output = `${JSON.stringify(report, null, 2)}\n`;
      } else if (markdown) {
        output = formatMarkdown(report);
      }
      if (out) {
        const { writeFile } = await import('node:fs/promises');
        await writeFile(out, output);
      } else {
        process.stdout.write(output);
      }
      if (failed) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 2;
  }
}
