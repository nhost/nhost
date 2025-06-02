/**
 * Check if the URL is a GraphQL Service URL with environment variable templating
 * @param url - The URL to check
 * @returns True if the URL is a GraphQL Service URL with environment variable templating, false otherwise
 */
export default function isGraphQLEnvURL(url: string) {
  // Check if the URL is surrounded by double curly braces {{ENVVAR}}
  return url.startsWith('{{') && url.endsWith('}}');
}
