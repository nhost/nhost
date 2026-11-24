import { z } from 'zod';

const position = z.object({
  line: z.number().int().positive(),
  column: z.number().int().positive(),
});
export const findingSchema = z.object({
  ruleId: z.string(),
  path: z.string(),
  subject: z.string(),
  guidance: z.string(),
  docs: z.string(),
  start: position,
  end: position,
  status: z.enum(['new', 'baselined', 'suppressed']),
});
export const reportSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(['complete', 'incomplete']),
  score: z.number().int().min(0).max(100).nullable(),
  rules: z.array(
    z.object({
      id: z.string(),
      count: z.number().int().nonnegative(),
      weight: z.number().positive(),
    }),
  ),
  files: z.array(
    z.object({
      path: z.string(),
      health: z.number().min(0).max(1),
      findings: z.array(findingSchema),
    }),
  ),
  suppressions: z.array(
    z.object({
      path: z.string(),
      ruleId: z.string(),
      start: position,
      reason: z.string().optional(),
      state: z.enum(['applied', 'unused', 'invalid']),
      count: z.number().int().nonnegative(),
      addedInPr: z.boolean().optional(),
    }),
  ),
  coverage: z.object({
    status: z.enum(['complete', 'incomplete']),
    expected: z.number().int().nonnegative(),
    processed: z.array(z.string()),
    skipped: z.array(
      z.object({
        path: z.string(),
        reason: z.enum(['parse-error', 'omitted', 'vcs-ignored']),
      }),
    ),
    vcsIgnored: z.enum(['known', 'unknown']),
  }),
  generated: z.object({
    stale: z.boolean(),
    changedInputs: z.array(z.string()),
  }),
  biomeVersion: z.object({
    expected: z.string(),
    actual: z.string(),
    mismatch: z.boolean(),
  }),
  baseline: z.object({
    exists: z.boolean(),
    baselined: z.number().int().nonnegative(),
    new: z.number().int().nonnegative(),
    slack: z.number().int().nonnegative(),
    stalePaths: z.array(z.string()),
    seededRules: z.array(z.string()),
  }),
});
export type Report = z.infer<typeof reportSchema>;
export type Finding = z.infer<typeof findingSchema>;
