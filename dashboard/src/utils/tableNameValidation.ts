export const MAX_POSTGRES_IDENTIFIER_LENGTH = 63;

export const validateTableName = (name: string): string | null => {
  if (!name) {
    return 'Table name is required';
  }

  if (name.length > MAX_POSTGRES_IDENTIFIER_LENGTH) {
    return `Table name must be ${MAX_POSTGRES_IDENTIFIER_LENGTH} characters or less`;
  }

  // Check for valid PostgreSQL identifier characters
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    return 'Table name must start with a letter or underscore and contain only letters, numbers, and underscores';
  }

  return null;
};
