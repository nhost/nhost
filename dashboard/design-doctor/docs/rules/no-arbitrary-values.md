# no-arbitrary-values

Tailwind v3 arbitrary appearance values bypass the dashboard's declared scales and tokens. This rule checks class sites (including `cn`, `cva`, `className`, and `*ClassName`) and arbitrary CSS properties. It does **not** claim layout utilities, arbitrary variants by themselves, or a value delegated directly to `var(--name)`; those are often necessary for dynamic geometry. `no-raw-colors` owns palette/white/black classes and literal SVG paint, **not** arbitrary colors: `bg-[#333]` belongs only to this rule. `no-unknown-classes` should skip the tokens claimed here.

```tsx
// Warns: use text-xs (exact), rounded-lg (exact), and p-3 or p-3.5 (nearest, not exact)
<div className="text-[12px] rounded-[8px] p-[13px]" />
// Warns: nearest declared color token (not exact), and a CSS property
<div className="bg-[#333] [padding:13px]" />
// OK: layout, custom-property value, and arbitrary variant
<div className="w-[320px] bg-[var(--brand)] bg-[--brand] [color:hsl(var(--primary))] [mask-type:alpha] [&>svg]:w-[320px]" />
```

Class tokens are separated on whitespace; use Tailwind v3 underscores for spaces inside an arbitrary value (`bg-[rgb(1_2_3)]`), not literal spaces. Run `pnpm design-doctor` for suggestions. Exact replacements are drawn from [resolved v3 scales](../../generated/tokens.md), including custom font sizes and border radii. A `DEFAULT` scale step renders as the bare utility (e.g. `rounded`), not `rounded-DEFAULT`; `ring` and `outline` cannot use that default because their bare forms have different meanings. For custom font-size steps such as `text-xs-`, check `cn()` output: tailwind-merge 1.14 treats these names as colors and may drop them next to another `text-*` class. Non-exact lengths use the closest **declared** scale steps (not invented classes). Arbitrary literal colors use the perceptually nearest valid declared token, labelled **nearest, not exact**; verify contrast in both themes. A token may need a declaration in `tailwind.config.js` under `theme.extend.colors` and a CSS variable in `src/styles/globals.css`; a CSS variable alone does not create a Tailwind color utility. `pnpm lint:design` reports the subject and points to the doctor rather than computing suggestions.

The generator probes the installed Tailwind v3 dynamic utility roots; it fails if a root lacks a category. The mapping (ported from `shadcn-ui/lint@9a55f6d` and adjusted for this v3 configuration) is:

| Category | Mapped roots |
| --- | --- |
| Layout (allowed) | `align`, `aspect`, `auto-cols`, `auto-rows`, `basis`, `bottom`, `col`, `col-end`, `col-start`, `columns`, `content`, `cursor`, `end`, `flex`, `flex-grow`, `flex-shrink`, `grid-cols`, `grid-rows`, `grow`, `h`, `inset`, `inset-x`, `inset-y`, `left`, `m`, `max-h`, `max-w`, `mb`, `me`, `min-h`, `min-w`, `ml`, `mr`, `ms`, `mt`, `mx`, `my`, `object`, `order`, `origin`, `right`, `rotate`, `row`, `row-end`, `row-start`, `scale`, `scale-x`, `scale-y`, `scroll-m`, `scroll-mb`, `scroll-me`, `scroll-ml`, `scroll-mr`, `scroll-ms`, `scroll-mt`, `scroll-mx`, `scroll-my`, `scroll-p`, `scroll-pb`, `scroll-pe`, `scroll-pl`, `scroll-pr`, `scroll-ps`, `scroll-pt`, `scroll-px`, `scroll-py`, `shrink`, `size`, `skew-x`, `skew-y`, `start`, `top`, `translate-x`, `translate-y`, `w`, `will-change`, `z` |
| Spacing | `border-spacing`, `border-spacing-x`, `border-spacing-y`, `gap`, `gap-x`, `gap-y`, `p`, `pb`, `pe`, `pl`, `pr`, `ps`, `pt`, `px`, `py`, `space-x`, `space-y` |
| Typography | `decoration`, `font`, `indent`, `leading`, `line-clamp`, `list`, `list-image`, `text`, `tracking`, `underline-offset` |
| Color | `accent`, `caret`, `fill`, `from`, `placeholder`, `to`, `via` |
| Shape | `border`, `border-b`, `border-e`, `border-l`, `border-r`, `border-s`, `border-t`, `border-x`, `border-y`, `divide`, `divide-x`, `divide-y`, `outline`, `outline-offset`, `ring`, `ring-offset`, `rounded`, `rounded-b`, `rounded-bl`, `rounded-br`, `rounded-e`, `rounded-ee`, `rounded-es`, `rounded-l`, `rounded-r`, `rounded-s`, `rounded-se`, `rounded-ss`, `rounded-t`, `rounded-tl`, `rounded-tr`, `stroke` |
| Effects | `backdrop-blur`, `backdrop-brightness`, `backdrop-contrast`, `backdrop-grayscale`, `backdrop-hue-rotate`, `backdrop-invert`, `backdrop-opacity`, `backdrop-saturate`, `backdrop-sepia`, `bg`, `bg-opacity`, `blur`, `border-opacity`, `brightness`, `contrast`, `divide-opacity`, `drop-shadow`, `grayscale`, `hue-rotate`, `invert`, `opacity`, `placeholder-opacity`, `ring-opacity`, `saturate`, `sepia`, `shadow`, `text-opacity` |
| Motion | `animate`, `animate-delay`, `delay`, `direction`, `duration`, `ease`, `fade-in`, `fade-out`, `fill-mode`, `repeat`, `slide-in-from-bottom`, `slide-in-from-left`, `slide-in-from-right`, `slide-in-from-top`, `slide-out-to-bottom`, `slide-out-to-left`, `slide-out-to-right`, `slide-out-to-top`, `spin-in`, `spin-out`, `transition`, `zoom-in`, `zoom-out` |

`text`, `bg`, `border`, `divide`, `outline`, `ring`, `stroke`, `shadow`, `drop-shadow` and `decoration` can mean different categories: a `#hex`, CSS color function or `color:` hint selects color; otherwise the root's usual appearance category applies. Arbitrary CSS properties are classified separately by CSS property name (e.g. padding = spacing, border-radius = shape, background-color = color); unrecognized properties stay outside this rule. The [fixed-seed audit](../../tests/arbitrary-values-audit.md) records 30 real source findings. These are suggestions for review, not safe automatic substitutions.
