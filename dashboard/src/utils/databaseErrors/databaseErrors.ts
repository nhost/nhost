import type { ApolloError } from '@apollo/client';

const CONSTRAINT_VIOLATION_REGEX =
  /violates (?:RESTRICT setting of )?(?:foreign key|unique|check|exclusion) constraint "([^"]+)"/;

function isApolloError(error: unknown): error is ApolloError {
  return error instanceof Error && error.name === 'ApolloError';
}

function collectErrorMessages(error: unknown): string[] {
  if (isApolloError(error)) {
    const messages = error.graphQLErrors.flatMap((graphQLError) => {
      const internalError = graphQLError.extensions?.internal as
        | { error?: { message?: string } }
        | undefined;

      return internalError?.error?.message
        ? [graphQLError.message, internalError.error.message]
        : [graphQLError.message];
    });

    return messages.length > 0 ? messages : [error.message];
  }

  if (error instanceof Error) {
    return [error.message];
  }

  return [];
}

export function getViolatedConstraint(error: unknown): string | null {
  for (const message of collectErrorMessages(error)) {
    const match = CONSTRAINT_VIOLATION_REGEX.exec(message);

    if (match) {
      return match[1];
    }
  }

  return null;
}

export function getErrorMessageSuffix(
  error: unknown,
  prefix: string,
): string | null {
  for (const message of collectErrorMessages(error)) {
    const index = message.indexOf(prefix);
    if (index !== -1) {
      return message
        .slice(index + prefix.length)
        .replace(/ \(SQLSTATE [0-9A-Z]{5}\)$/, '')
        .trim();
    }
  }
  return null;
}

export function errorMessageIncludes(error: unknown, text: string): boolean {
  return collectErrorMessages(error).some((message) => message.includes(text));
}
