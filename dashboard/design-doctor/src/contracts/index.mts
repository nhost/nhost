import { z } from 'zod';

export const indexSchema = z.object({
  schemaVersion: z.literal(1),
  artifacts: z.array(z.string()),
  inputs: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
});
export type GeneratedIndex = z.infer<typeof indexSchema>;
