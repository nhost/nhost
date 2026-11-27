import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const EMAILS = join(__dirname, '../../../../nhost/emails');

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

  // clientUrl is the app's custom scheme, which mail apps rarely turn into a
  // link. The code email shows only the code, since the app is already on the
  // screen that asks for it.
  it('never link to clientUrl, including the code email', () => {
    const linked = walk(EMAILS)
      .filter((file) => /\$\{clientUrl\}/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(EMAILS, file));

    expect(linked).toEqual([]);
  });
});
