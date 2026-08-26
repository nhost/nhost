import { useEffect, useRef, useState } from 'react';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

interface GraphQLPlaygroundHeaders {
  headerText: string;
  headersTabOverrides: Record<string, unknown>;
  setHeaderText: (headers: string) => void;
}

function parseHeaderText(headers: string): Record<string, unknown> | null {
  if (!headers) {
    return {};
  }

  try {
    const parsedHeaders: unknown = JSON.parse(headers);

    if (
      typeof parsedHeaders !== 'object' ||
      parsedHeaders === null ||
      Array.isArray(parsedHeaders)
    ) {
      return null;
    }

    return parsedHeaders as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default function useGraphQLPlaygroundHeaders(
  appSubdomain: string,
): GraphQLPlaygroundHeaders {
  const [headerText, setHeaderText] = useSSRLocalStorage(
    `nhost_graphql_playground_headers:${appSubdomain}`,
    '',
  );
  const [headersTabOverrides, setHeadersTabOverrides] = useState<
    Record<string, unknown>
  >(() => parseHeaderText(headerText) ?? {});
  const previousHeaderText = useRef(headerText);

  useEffect(() => {
    if (previousHeaderText.current === headerText) {
      return;
    }

    previousHeaderText.current = headerText;
    const parsedHeaders = parseHeaderText(headerText);

    if (parsedHeaders !== null) {
      setHeadersTabOverrides(parsedHeaders);
    }
  }, [headerText]);

  return { headerText, headersTabOverrides, setHeaderText };
}
