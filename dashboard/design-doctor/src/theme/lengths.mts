/**
 * MIT-licensed code from shadcn-ui/lint@9a55f6d.
 * Copyright (c) 2026 shadcn. See ../../NOTICE.md.
 */
// A CSS length in pixels, with enough calc() to read the scales a theme
// declares. Anything else (percentages, clamp, unknown units) is null.

const REM = 16;

type Value = { px: number } | { n: number };

type Token =
  | { kind: 'num'; value: Value }
  | { kind: 'op'; op: string }
  | { kind: '(' }
  | { kind: ')' };

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  const re =
    /\s*(?:(calc\(|\()|(\))|([+\-*/])|(\d*\.?\d+(?:e[+-]?\d+)?)(px|rem|em|%)?)/giy;
  let last = 0;
  let match: RegExpExecArray | null;
  while (last < input.length) {
    re.lastIndex = last;
    match = re.exec(input);
    if (!match || match[0].length === 0) {
      return /^\s*$/.test(input.slice(last)) ? tokens : null;
    }
    last = re.lastIndex;
    if (match[1]) {
      tokens.push({ kind: '(' });
    } else if (match[2]) {
      tokens.push({ kind: ')' });
    } else if (match[3]) {
      tokens.push({ kind: 'op', op: match[3] });
    } else {
      const number = Number(match[4]);
      const unit = (match[5] ?? '').toLowerCase();
      if (unit === '%') {
        return null;
      }
      const value: Value =
        unit === 'px'
          ? { px: number }
          : unit === 'rem' || unit === 'em'
            ? { px: number * REM }
            : { n: number };
      tokens.push({ kind: 'num', value });
    }
  }
  return tokens;
}

function add(a: Value, b: Value, sign: number): Value | null {
  if ('px' in a && 'px' in b) {
    return { px: a.px + sign * b.px };
  }
  if ('n' in a && 'n' in b) {
    return { n: a.n + sign * b.n };
  }
  if ('n' in a && a.n === 0 && 'px' in b) {
    return { px: sign * b.px };
  }
  if ('px' in a && 'n' in b && b.n === 0) {
    return a;
  }
  return null;
}

function multiply(a: Value, b: Value): Value | null {
  if ('n' in a && 'n' in b) {
    return { n: a.n * b.n };
  }
  if ('px' in a && 'n' in b) {
    return { px: a.px * b.n };
  }
  if ('n' in a && 'px' in b) {
    return { px: a.n * b.px };
  }
  return null;
}

function divide(a: Value, b: Value): Value | null {
  if (!('n' in b) || b.n === 0) {
    return null;
  }
  return 'px' in a ? { px: a.px / b.n } : { n: a.n / b.n };
}

function evaluate(tokens: Token[]): Value | null {
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];

  const factor = (): Value | null => {
    const token = next();
    if (!token) {
      return null;
    }
    if (token.kind === 'num') {
      return token.value;
    }
    if (token.kind === 'op' && token.op === '-') {
      const inner = factor();
      return inner && ('px' in inner ? { px: -inner.px } : { n: -inner.n });
    }
    if (token.kind === 'op' && token.op === '+') {
      return factor();
    }
    if (token.kind === '(') {
      const inner = sum();
      const close = next();
      return close?.kind === ')' ? inner : null;
    }
    return null;
  };

  const product = (): Value | null => {
    let left = factor();
    while (left) {
      const token = peek();
      if (token?.kind !== 'op' || (token.op !== '*' && token.op !== '/')) {
        break;
      }
      next();
      const right = factor();
      if (!right) {
        return null;
      }
      left = token.op === '*' ? multiply(left, right) : divide(left, right);
    }
    return left;
  };

  const sum = (): Value | null => {
    let left = product();
    while (left) {
      const token = peek();
      if (token?.kind !== 'op' || (token.op !== '+' && token.op !== '-')) {
        break;
      }
      next();
      const right = product();
      if (!right) {
        return null;
      }
      left = add(left, right, token.op === '+' ? 1 : -1);
    }
    return left;
  };

  const result = sum();
  return i === tokens.length ? result : null;
}

export function lengthInPx(value: string) {
  const tokens = tokenize(value.trim());
  if (!tokens?.length) {
    return null;
  }
  const result = evaluate(tokens);
  if (!result) {
    return null;
  }
  if ('px' in result) {
    return result.px;
  }
  return result.n === 0 ? 0 : null;
}

export function formatPx(px: number) {
  return `${Number(px.toFixed(2))}px`;
}
