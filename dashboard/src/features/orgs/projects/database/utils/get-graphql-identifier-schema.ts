import { z } from 'zod';

export const getGraphQLIdentifierSchema = (
  fieldName: string,
  requiredMessage?: string,
) =>
  z
    .string()
    .min(1, { message: requiredMessage ?? `${fieldName} is required` })
    .regex(/^([A-Za-z]|_)+/i, {
      message: `${fieldName} must start with a letter or underscore.`,
    })
    .regex(/^\w+$/i, {
      message: `${fieldName} must contain only letters, numbers, or underscores.`,
    });
