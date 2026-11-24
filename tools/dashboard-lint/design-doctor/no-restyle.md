# no-restyle

Ported from [shadcn-ui/lint](https://github.com/shadcn-ui/lint) `no-restyle` (f1c81bd, MIT). Local to dashboard-lint; not part of design-doctor.

A design-system component owns its appearance. `className` on it may carry only what the policy allows; appearance comes from the component's variants and sizes. The policy here is shadcn-lint's recommended one: **layout only**.

```tsx
import { Button } from '@/components/ui/v3/button';

// Allowed: layout (margin, width, position, display, flex and grid placement, transforms).
<Button className="mt-4 w-full">Save changes</Button>
<Button size="lg" variant="destructive">Delete account</Button>

// Reported: spacing, color, shape.
<Button className="p-4 bg-pink-500 rounded-full">Save changes</Button>
```

## What is checked

- Every component imported from `@/components/ui/v3/*` (named, aliased, default or namespace imports), except `ui/v3/icons`. Unstyled exports such as `TooltipTrigger` are checked too, as in shadcn-lint.
- Files in design-doctor's scope: `dashboard/src` without `ui/v3`, tests and generated code.
- `className` values: string literals, the static parts of template literals, `cn`/`clsx`/`cx`/`twMerge`/`twJoin`/`classNames` arguments, both branches of conditionals and `&&`/`||`/`??`, arrays, clsx object keys, and same-file constants. A class glued to an interpolation (`p-${size}`) is left to `require-static-classes`.
- Radix `asChild`: the classes of the child element merge into the component, so they are checked against it (`<Button asChild><a className="p-4">` is spacing on Button).

## Categories

| Category | Examples | With `allow: ["layout"]` |
|---|---|---|
| layout | `mt-4`, `w-full`, `hidden`, `absolute`, `flex-1`, `sr-only`, `text-left` | allowed |
| spacing | `p-4`, `gap-2`, `space-x-4` | reported; Button-like components suggest their sizes |
| typography | `text-sm`, `text-sm+`, `font-medium`, `leading-none`, `truncate` | reported |
| color | `bg-primary`, `text-destructive`, `border-input`, `bg-opacity-50` | reported |
| shape | `rounded-md`, `border`, `ring-2`, `outline-none` | reported |
| effects | `shadow-sm`, `opacity-50`, `backdrop-blur` | reported |
| motion | `transition-colors`, `duration-200`, `animate-in`, `fade-in` | reported |
| declared / unclassified | a class only `src/styles` declares, or one Tailwind cannot generate | reported |

A class is classified by what it does in this dashboard: the CSS properties the dashboard's own Tailwind config generates for it (so `text-sm+` is typography). A few groups keep shadcn-lint's category because their CSS misleads: `sr-only` is layout, `space-x/y-*` spacing, `ring-*` widths shape, the Tailwind 3 `*-opacity-*` utilities color. Classes Tailwind cannot generate fall back to the tailwind-merge class group (shadcn-lint's category table).

## Fixing a finding

- Spacing on a component with sizes: use a size (`size="lg"`), or margin on it or gap on the parent for space around it.
- Appearance: use one of the listed variants. Add a variant to the component (`dashboard/src/components/ui/v3/…`) only if the design explicitly calls for a treatment none of them provides; then use it by name.
- Layout that is not allowed by a contract: put it on a parent element.

## Policy file

`design-doctor/restyle.json` in the dashboard-lint folder, with shadcn-lint's options: `allow`, `deny`, and `contracts: [{ pattern, allow, deny }]`. Entries are categories, tailwind-merge class groups (`p`, `bg-color`, `rounded`) or classes with `*` patterns. A contract's `pattern` is a regex on the component name; the last matching contract applies and inherits what it does not set.

## Differences from shadcn-lint

- Wrappers are not followed: a local component that forwards `className` to Button is not checked as Button.
- No custom messages per category, and no `componentImports` options; recognition is fixed to `ui/v3`.
- Classification uses the dashboard's Tailwind 3 output first, not only the class-name grammar.

## How findings are counted

Like the other design rules: a finding is new when the count of `<Component> <class>` (for example `Button text-destructive`) goes up across the changed files compared with the merge-base. Moving or reordering classes reports nothing.
