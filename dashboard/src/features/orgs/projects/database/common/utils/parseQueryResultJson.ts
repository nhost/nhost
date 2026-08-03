export default function parseQueryResultJson<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error: unknown) {
    throw new Error('The database returned invalid JSON.', { cause: error });
  }
}
