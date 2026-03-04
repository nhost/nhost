// Words that should use a specific casing instead of naive Title Case
const SPECIAL_CASINGS: Record<string, string> = {
  cli: 'CLI',
  mcp: 'MCP',
  ai: 'AI',
  api: 'API',
  sdk: 'SDK',
  graphql: 'GraphQL',
  oauth2: 'OAuth2',
  js: 'JS',
  nextjs: 'Next.js',
  reactnative: 'React Native',
  sql: 'SQL',
  url: 'URL',
};

function capitalizeWord(word: string): string {
  return (
    SPECIAL_CASINGS[word.toLowerCase()] ??
    word.charAt(0).toUpperCase() + word.slice(1)
  );
}

function capitalizeSegment(segment: string): string {
  // Check if the entire segment (before splitting on hyphens) has a special casing
  if (SPECIAL_CASINGS[segment.toLowerCase()]) {
    return SPECIAL_CASINGS[segment.toLowerCase()];
  }
  return segment.split('-').map(capitalizeWord).join(' ');
}

export function getBreadcrumb(slug: string): string {
  const parts = slug.split('/');
  // Remove the last part (the page itself) to get the section path
  const sectionParts = parts.slice(0, -1);
  return sectionParts.map(capitalizeSegment).join(' > ');
}

/**
 * For generic titles like "Overview", derive a more meaningful title
 * from the slug so the OG image is informative on its own.
 */
export function getDisplayTitle(title: string, slug: string): string {
  const genericTitles = new Set(['overview']);
  if (!genericTitles.has(title.toLowerCase())) return title;

  const lastSegment = slug.split('/').pop() || '';
  const sectionName = capitalizeSegment(lastSegment);

  // Avoid "Overview Overview"
  if (sectionName.toLowerCase() === title.toLowerCase()) return title;

  return `${sectionName} ${title}`;
}
