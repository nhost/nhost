import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const EMAILS = fileURLToPath(
  new URL('../../../../nhost/emails', import.meta.url),
);

// Auth pastes template variables in without escaping them, so a template may
// only use the ones auth builds itself or reads from config. `redirectTo`,
// `email` and `displayName` come from the request.
const SAFE = new Set(['link', 'ticket', 'code', 'clientUrl', 'serverUrl']);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe('email templates', () => {
  it('only use variables the caller cannot set', () => {
    const unsafe = walk(EMAILS).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/\$\{(\w+)\}/g)]
        .filter(([, name]) => !SAFE.has(name))
        .map(([variable]) => `${relative(EMAILS, file)}: ${variable}`),
    );

    expect(unsafe).toEqual([]);
  });
});
