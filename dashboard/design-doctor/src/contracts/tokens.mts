import { z } from 'zod';

const color = z.object({
  expression: z.string(),
  light: z.string().nullable(),
  dark: z.string().nullable(),
  themeAware: z.boolean(),
  valid: z.boolean(),
});

export const tokensSchema = z.object({
  schemaVersion: z.literal(1),
  colors: z.record(z.string(), color),
  cssVariables: z.record(
    z.string(),
    z.object({ light: z.string().nullable(), dark: z.string().nullable() }),
  ),
  scales: z.record(
    z.string(),
    z.record(
      z.string(),
      z.object({ value: z.string(), px: z.number().nullable() }),
    ),
  ),
});
export type Tokens = z.infer<typeof tokensSchema>;
