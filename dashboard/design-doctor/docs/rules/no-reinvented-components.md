# no-reinvented-components

Outside `src/components/ui/v3/`, use the shared component catalog instead of raw JSX elements. Tests, test utilities, mocks and generated sources are excluded. This rule checks both paired and self-closing JSX:

| Raw JSX | Use instead |
| --- | --- |
| `<button>` | `Button` from `@/components/ui/v3/button` (variants, sizes and `asChild`) |
| `<input type="checkbox">` | `Checkbox` from `@/components/ui/v3/checkbox` |
| `<input type="radio">` | `RadioGroup` from `@/components/ui/v3/radio-group` |
| Other `<input>` | `Input` from `@/components/ui/v3/input` or `FormInput` from `@/components/form/FormInput` for a managed field |
| `<textarea>` | `Textarea` from `@/components/ui/v3/textarea` |
| `<select>` | `Select` from `@/components/ui/v3/select` with its trigger and content |
| `<table>` | `Table` from `@/components/ui/v3/table` with its companion elements |
| `<a>` | `TextLink` from `@/components/ui/v3/text-link` |

`<input type="file">`, `hidden`, `range` and inputs with dynamic `type` are exempt. Static quoted types in JSX expressions (such as `type={'radio'}`) are checked. Raw JSX immediately inside an `asChild` element is exempt, including a conditional or logical child (`<Trigger asChild>{ready && <button />}</Trigger>`). `asChild={false}` does not exempt the child; nested raw elements inside a wrapper are not exempt. The rule does not infer what a custom element does.

These suggestions are **not safe drop-in substitutions**. Check props, markup, keyboard behavior and accessibility before changing an element. For example, Select is a composed Radix control, not a native `<select>` equivalent; TextLink may use app navigation behavior. The mappings and Button's listed variants/sizes come from `design-doctor/catalog.meta.mts` and the generated component catalog. Edit catalog metadata and run `pnpm design-doctor generate`; do not edit the generated Grit plugin.
