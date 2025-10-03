function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function highlightMatch(text: string, query: string) {
  if (!query) {
    return text;
  }

  const safe = escapeRegExp(query);
  const regex = new RegExp(safe, 'gi');
  const nodes: Array<JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match) {
    const start = match.index;
    const end = start + match[0].length;

    if (start > lastIndex) {
      const chunk = text.slice(lastIndex, start);
      nodes.push(<span key={`seg-${lastIndex}`}>{chunk}</span>);
    }

    nodes.push(
      <mark
        key={`hit-${start}`}
        className="rounded bg-yellow-300/60 px-0.5 dark:bg-yellow-200/60"
      >
        {match[0]}
      </mark>,
    );

    lastIndex = end;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={`seg-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return nodes;
}
