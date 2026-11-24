// One entry per rule. `engine` says who finds it: Biome (built-in rule or GritQL
// plugin) or the TypeScript checks in checks.mjs. `fileLevel` rules decide for
// themselves whether a finding is new, so the added-lines filter skips them.
export const RULES = [
  {
    id: 'it-not-test',
    engine: 'biome',
    biome: 'lint/nursery/useConsistentTestIt',
    summary: 'Use `it`, not `test`, in Vitest tests.',
    hint: 'Rename test(...) to it(...). Biome fixes it with: biome lint --write --only=nursery/useConsistentTestIt <file>',
  },
  {
    id: 'no-nested-ternary',
    engine: 'biome',
    biome: 'lint/style/noNestedTernary',
    summary: 'Do not nest ternary expressions.',
    hint: 'Use early returns, separate variables, or a lookup object.',
  },
  {
    id: 'no-conditional-expect',
    engine: 'biome',
    biome: 'lint/nursery/noConditionalExpect',
    summary: 'No `expect` inside if, ternary, `&&` or catch in tests.',
    hint: 'Give each case its own it(...) with unconditional assertions. Keep it.each tables free of branching.',
  },
  {
    id: 'no-fire-event',
    engine: 'biome-plugin',
    summary: 'Use TestUserEvent instead of fireEvent in tests.',
    hint: "const user = new TestUserEvent(); await user.click(...) (from '@/tests/testUtils'). If user events truly cannot express it, add a biome-ignore with the reason.",
  },
  {
    id: 'no-vitest-imports',
    engine: 'script',
    summary: 'Vitest globals are enabled; do not import describe, it, expect, vi or hooks.',
    hint: "Delete the import. Type-only imports (import type { Mock } from 'vitest') are fine.",
  },
  {
    id: 'no-query-selector-in-tests',
    engine: 'biome-plugin',
    summary: 'Query elements the way a user finds them, not with querySelector.',
    hint: 'Use screen.getByRole, getByLabelText or getByText.',
  },
  {
    id: 'no-jsx-comments',
    engine: 'biome-plugin',
    summary: 'Do not label JSX with comments.',
    hint: 'Delete the comment, or extract a well-named component.',
  },
  {
    id: 'import-folder-not-file',
    engine: 'script',
    summary: 'Import a module through its folder (index.ts), not the file inside it.',
    hint: "From outside the folder: import { Foo } from '@/path/Foo'. From inside it: import Foo from './Foo'. Make sure Foo/index.ts exports it.",
  },
  {
    id: 'effect-only-sets-state',
    engine: 'script',
    summary: 'This effect only copies a value into state.',
    hint: 'Derive the value during render, update it in the event handler, or reset the subtree with a key. See react.dev/learn/you-might-not-need-an-effect',
  },
  {
    id: 'function-declarations',
    engine: 'script',
    summary: 'Use a function declaration for top-level functions and components.',
    hint: 'function Foo(props: FooProps) { ... } or export default function Foo(...). Arrow functions stay fine inside functions.',
  },
  {
    id: 'types-folder-only-types',
    engine: 'script',
    summary: 'Files in a types/ folder only declare types.',
    hint: 'Move constants and functions to a utils/ or constants file next to the feature.',
  },
  {
    id: 'feature-boundaries',
    engine: 'script',
    summary: 'A project feature imports only from itself, `common` or `hooks`.',
    hint: 'Move the shared code to features/orgs/projects/common (or projects/hooks for hooks) and import it from there.',
  },
  {
    id: 'index-reexport-shape',
    engine: 'script',
    summary: "index.ts re-exports with relative paths and named defaults.",
    hint: "export { default as Foo } from './Foo'; export * from './Foo'; never '@/...' paths or an unnamed export { default }.",
  },
  {
    id: 'main-file-default-export',
    engine: 'script',
    fileLevel: true,
    summary: 'A new Foo/Foo.ts(x) has a default export named Foo.',
    hint: 'export default function Foo(...) { ... }, and re-export it from Foo/index.ts.',
  },
  {
    id: 'folder-needs-index',
    engine: 'script',
    fileLevel: true,
    summary: "A new Foo/Foo.ts(x) needs Foo/index.ts with export { default as Foo } from './Foo'.",
    hint: "Create Foo/index.ts: export { default as Foo } from './Foo'; plus export * from './Foo' if it has prop types.",
  },
  {
    id: 'barrel-exports-used-outside',
    engine: 'script',
    summary: 'index.ts exports only what code outside the folder imports.',
    hint: "Remove it from index.ts. Code inside the folder imports it with './file'.",
  },
  {
    id: 'max-file-lines',
    engine: 'script',
    fileLevel: true,
    summary: 'A source file grows past 500 lines.',
    hint: 'Split it: move sections, sub-components or helpers into their own files.',
  },
  {
    id: 'design',
    engine: 'design-doctor',
    summary: 'Design-system findings this change introduces (design-doctor): raw colors, arbitrary values, unknown classes, inline styles, dynamic class names, reinvented components, direct Radix imports, restyled ui/v3 components (no-restyle), added design-doctor-ignore comments.',
    hint: 'Each finding names the token or component to use. Details: dashboard-lint design explain <rule>.',
  },
];

export const RULES_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));
export const RULE_ID_BY_BIOME_CODE = new Map(
  RULES.filter((rule) => rule.biome).map((rule) => [rule.biome, rule.id]),
);
