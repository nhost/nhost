import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { codeChallenge, generatePKCEPair } from '@/lib/nhost/pkce';

describe('PKCE', () => {
  it('derives the challenge of RFC 7636, appendix B', async () => {
    expect(
      await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('makes a fresh 43-character verifier each time', async () => {
    const first = await generatePKCEPair();
    const second = await generatePKCEPair();

    expect(first.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.challenge).toBe(await codeChallenge(first.verifier));
    expect(second.verifier).not.toBe(first.verifier);
  });
});

// Every SDK call that sends auth a `redirectTo` gets a session back through
// that link, so it has to pass a `codeChallenge` too. Linking a provider
// (`connect`) is the one exception: auth returns to `redirectTo` untouched,
// with no session to protect.
const SRC = resolve(__dirname, '../..');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'test' ? [] : walk(path);
    }
    return /(?<!\.test)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// Comments and string literals, blanked out so only code is searched. Each
// match starts where the earliest of them does, so a quote in a comment or
// `//` in a string is read as part of it.
const NOT_CODE =
  /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

const codeOnly = (source: string): string =>
  source.replace(NOT_CODE, (match) => ' '.repeat(match.length));

/** Each call whose arguments hold `redirectTo` but no challenge. */
function unprotectedCalls(source: string): string[] {
  const code = codeOnly(source);
  const found = new Set<string>();

  for (const match of code.matchAll(/\bredirectTo\b/g)) {
    let depth = 0;
    let open = -1;
    for (let at = match.index - 1; at >= 0 && open === -1; at--) {
      if (code[at] === ')') {
        depth++;
      } else if (code[at] === '(') {
        if (depth === 0) {
          open = at;
        }
        depth--;
      }
    }
    if (open === -1) {
      continue;
    }

    let close = code.length;
    depth = 0;
    for (let at = open; at < code.length && close === code.length; at++) {
      if (code[at] === '(') {
        depth++;
      } else if (code[at] === ')' && --depth === 0) {
        close = at;
      }
    }

    const args = code.slice(open, close + 1);
    if (
      !/\bcodeChallenge\b/.test(args) &&
      !/[{,]\s*connect\s*[:,}]/.test(args)
    ) {
      found.add(/[\w.$]+\s*$/.exec(code.slice(0, open))?.[0] ?? '(call)');
    }
  }

  return [...found];
}

describe('links back into the app', () => {
  it('carry a PKCE challenge in every call under src/', () => {
    const offenders = walk(SRC).flatMap((file) =>
      unprotectedCalls(readFileSync(file, 'utf8')).map(
        (call) => `${relative(SRC, file)}: ${call}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});

describe('the PKCE check', () => {
  it('finds a redirect without a challenge, however deep', () => {
    expect(
      unprotectedCalls(`
        await nhost.auth.signInPasswordlessEmail({
          email,
          options: { redirectTo: appUrl(destination) },
        });
        await nhost.auth.sendVerificationEmail({ email, options: { redirectTo } });
      `),
    ).toEqual([
      'nhost.auth.signInPasswordlessEmail',
      'nhost.auth.sendVerificationEmail',
    ]);
  });

  it('allows a challenge beside the redirect, and connect', () => {
    expect(
      unprotectedCalls(`
        const { codeChallenge, redirectTo } = await startFlow('signIn', next);
        await nhost.auth.signInPasswordlessEmail({
          email,
          options: { redirectTo },
          codeChallenge,
        });
        nhost.auth.signInProviderURL(id, { connect: accessToken, redirectTo });
        // nhost.auth.signUpEmailPassword({ options: { redirectTo } })
        messages.set('redirectTo-not-allowed', "it's // not a redirectTo");
      `),
    ).toEqual([]);
  });
});
