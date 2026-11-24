# no-direct-radix-imports

Import design-system primitives from `@/components/ui/v3/*`, not `@radix-ui/*`, outside `src/components/ui/v3/`. `@radix-ui/react-slot` is allowed for composition. Static imports (including types and namespaces), re-exports, side-effect imports and dynamic `import()` are checked. Tests, test utilities, mocks and generated sources are exempt.

For a named import or re-export, the subject is the imported primitive name before any alias and the warning names a catalog export when one is recorded. This is **not** necessarily a safe drop-in replacement: verify props, accessibility, behavior and markup before migrating. A primitive absent from the catalog has no exact known replacement; consult `design-doctor/generated/catalog.md` or design. A namespace import's subject is the local namespace identifier (e.g. `DialogPrimitive`); import the individual ui/v3 exports actually used. A default import's subject is likewise its local binding; it has no known primitive-level replacement. Side-effect imports, dynamic imports and both `export * from` and `export * as ns from` use the quoted module literal as their subject, normalizing double quotes to single quotes so formatting does not change its baseline key. Those forms do not identify a single primitive.

```tsx
// Avoid
import { DialogDescription } from '@radix-ui/react-dialog';
// Prefer (after verifying props and behavior)
import { DialogDescription } from '@/components/ui/v3/dialog';
```

The Radix name map is generated from the component catalog, including short aliases such as `Trigger` and `Content` for Collapsible and the bare component name (`Dialog`, not `DialogRoot`) for `Root`. Edit the wrapper or catalog source and run `pnpm design-doctor generate`; do not edit the plugin.
