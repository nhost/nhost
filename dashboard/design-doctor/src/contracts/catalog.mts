import { z } from 'zod';

export const catalogMetaEntrySchema = z.object({
  purpose: z.string().min(1),
  replaces: z.array(z.string()),
  dropIn: z.boolean(),
});

const recipeSchema = z.object({
  name: z.string(),
  variants: z.record(z.string(), z.array(z.string())),
  defaultVariants: z.record(z.string(), z.string()),
  conditionalDefaults: z.record(z.string(), z.record(z.string(), z.string())),
});

const componentSchema = z.object({
  name: z.string(),
  importPath: z.string(),
  source: z.string(),
  purpose: z.string().nullable(),
  replaces: z.array(z.string()),
  dropIn: z.boolean(),
  cva: z.array(recipeSchema),
  radix: z.object({ package: z.string(), primitive: z.string() }).nullable(),
});

export const catalogSchema = z.object({
  schemaVersion: z.literal(1),
  modules: z.array(
    z.object({ importPath: z.string(), exports: z.array(z.string()) }),
  ),
  components: z.array(componentSchema),
  undocumented: z.array(z.string()),
});
export type Catalog = z.infer<typeof catalogSchema>;
export type CatalogMeta = Record<
  string,
  z.infer<typeof catalogMetaEntrySchema>
>;
