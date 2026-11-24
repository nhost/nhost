# require-static-classes

Tailwind v3 generates CSS only for complete class strings it finds in source. A class assembled around a template interpolation may never get CSS, and the other design rules cannot validate its pieces. This warning applies to class attributes (including `*ClassName`) and `cn`/`clsx`/`cx`/`twMerge`/`twJoin`/`tw`/`cva` arguments, even on plain elements. Components imported from catalogued `@/components/ui/v3/*` or `@/components/{form,common,presentational}/*` also warn on unreadable `className` values. The design-system rule recognizes named imports, aliases, defaults and namespace members; merely naming a local component `Button` does not opt it in.

The following examples adapt the policy of shadcn-ui/lint@9a55f6d (MIT; see `../../NOTICE.md`) to this dashboard's ui/v3 imports:

```tsx
import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

<Button className="mt-4" />;
<Button className={wide ? 'w-full' : 'w-auto'} />;
<Button className={cn('mt-4', wide && 'w-full')} />;
<Button className={className} />; // forwarded prop
<Button className={labelClass} />; // class-prop naming convention
```

```tsx
<Button className={`bg-${color}`} />; // require-static-classes: bg-${…}
<Button className={buttonVariants()} />; // require-static-classes: Button buttonVariants()
<Button className={styles.root} />; // require-static-classes: Button styles.root
<Button className={wide ? 'w-full' : layout} />; // require-static-classes: Button layout
<div className={`w-[${width}px]`} />; // require-static-classes: w-[${…}px]
```

An imported `buttonClasses` is not resolved by the class-site prelude and is reported even though its name follows the convention. Inline complete classes (or define a same-file `*ClassName`/`*Classes` constant for the convention context to scan). For a finite value, use a lookup from each value to a **complete** class such as `{ success: 'bg-primary', error: 'bg-destructive' }`, or a conditional between complete strings. For continuous values, set a CSS custom property and use a stable var-based utility such as `w-[var(--x)]`. A helper call is exempt here; its literal arguments still pass through the other class rules. Whitespace-separated interpolation (`` `flex ${extra}` ``) does not glue a fragment and is not flagged.

Subjects have no source lines: a glued fragment uses `${…}` in place of expression text; a design-system value uses the JSX tag and an identifier, member or callee with empty parentheses (call arguments are omitted for calls). Member expressions over calls retain flattened arguments, for example `Input getA(1).b`. Glued-edge joining depends on position around the **final** interpolation: `` `text-${b} w-[${a}px]` `` reports `w-[${…}px]`, while `` `w-[${a}px] ${b}` `` reports `w-[${…}` and `${…}px]`. In a multi-interpolation template, adjacent chunk edges are reported separately when a chunk touches interpolations on both sides; one diagnostic can hold both edge subjects. Position-based checks avoid treating a repeated token later in the same template as glued merely because it has the same spelling; the final-edge join uses chunk-text equality, so `` `${a} w-[${b} w-[${c}px]` `` can report `w-[${…}px]` twice. Other rules check complete static tokens independently.

Accuracy limits: a namespace member is checked against catalogued component names overall, not against the individual module's export list; if two catalog modules export different names, `UI.OtherComponent` can be treated as design-system even though `UI`'s module does not export it. A completely unknown member (`UI.DoesNotExist`) passes. `+` concatenation such as `'bg-' + color` is not reported; the optional probe exceeded its 0.03 s allowance. Optional member names such as `props?.className` are forwarded, but `props!.className` is reported. Other optional members such as `x?.y` are reported but their values are not resolved. Member-over-call subjects keep formatter-inserted trailing commas in call arguments. Nested expression forms (including compound/nested conditionals), dynamic string manipulation, and classes hidden inside non-helper calls are not resolved. Simple conditional and logical branches with unreadable identifier, member or call values are checked; two unreadable conditional branches share one diagnostic with two subjects. Prefer explicit, complete strings in these cases.
