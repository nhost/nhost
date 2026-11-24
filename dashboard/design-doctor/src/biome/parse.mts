import { CLASS_SUBJECT_SEPARATOR } from '../grit/prelude/classes.mts';

export interface DesignMessage {
  ruleId: string;
  subjects: { subject: string; guidance: string }[];
  docs: string;
}

export function parseMessage(message: string): DesignMessage | null {
  const [head, ...rest] = message.split('\n');
  const prefix = /^\[design\/([a-z-]+)\] ([\s\S]*)$/.exec(head);
  if (!prefix) {
    return null;
  }
  const content = [prefix[2], ...rest].join('\n');
  const docsMatch = / Docs: (design-doctor\/docs\/rules\/([a-z-]+)\.md)$/.exec(
    content,
  );
  if (!docsMatch || docsMatch[2] !== prefix[1]) {
    return null;
  }
  const payload = content.slice(0, docsMatch.index);
  // Class rules encode a list of subjects at one syntax-node span. The final
  // separator is mandatory; a truncated diagnostic must fail the contract.
  const classMatch = /^([\s\S]*\u2028) Guidance: ([^\n]+)$/.exec(payload);
  if (classMatch) {
    const tokens = classMatch[1].slice(0, -1).split(CLASS_SUBJECT_SEPARATOR);
    // Template interpolation can split brackets across chunks. The delimiter
    // and empty-token checks establish framing; fragments need not be balanced.
    if (tokens.some((token) => !token)) {
      return null;
    }
    return {
      ruleId: prefix[1],
      subjects: tokens.map((subject) => ({
        subject,
        guidance: classMatch[2],
      })),
      docs: docsMatch[1],
    };
  }
  const lines = payload.split('\n');
  const subjects = lines.map((line) => {
    const match = /^"([\s\S]+?)" ([\s\S]+)$/.exec(line);
    if (!match) {
      return null;
    }
    const subject = match[1];
    return {
      subject:
        subject.startsWith('"') && subject.endsWith('"')
          ? `'${subject.slice(1, -1)}'`
          : subject,
      guidance: match[2],
    };
  });
  if (subjects.some((subject) => !subject)) {
    return null;
  }
  return {
    ruleId: prefix[1],
    subjects: subjects as DesignMessage['subjects'],
    docs: docsMatch[1],
  };
}
