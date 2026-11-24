# no-inline-styles

Use Tailwind v3 classes for styling. This rule reports each ordinary property in a JSX `style={{ … }}` object separately, including objects wrapped in parentheses, `as` and `satisfies`; it also reports literal colors in CSS custom properties, unreadable styles and `<style>` elements. All JSX elements in the manifest scope, including SVG and components, are checked. Findings are warnings; existing dashboard sites are baselined, not exempted.

```tsx
<div className="text-primary">Account settings</div> // OK
<div style={{ color: 'red', marginTop: 4 }} /> // two findings: color, marginTop
<div style={{ '--panel-width': `${width}px` } as React.CSSProperties} className="w-[var(--panel-width)]" /> // OK
<div style={{ '--label-color': 'hsl(var(--primary))' }} /> // OK
<div style={{ '--label-color': '#ec4899' }} /> // customPropColor: use a declared token
<div style={{ '--shadow': '0 0 4px red' }} /> // customPropColor
<style>{'.panel { color: red; }'}</style> // finding: move shared CSS to src/styles/globals.css
```

See [`generated/tokens.md`](../../generated/tokens.md) for declared colors. For a continuous dynamic value, pass only a CSS custom property and consume it from a **v3** arbitrary-value class: `style={{ '--x': width }}` and `className="w-[var(--x)]"` (not Tailwind v4's `w-(--x)`). A static property should use a class. A custom property's static text is checked for hex, CSS named colors, literal-channel color functions, and colors in gradients or shadows; `var(--x)` and `hsl(var(--primary))` pass. Template literals are checked chunk by chunk, without inferring their interpolated contents.

The computed `floatingStyles` and `provided.draggableProps.style` (also under `as CSSProperties`) pass. Forwarded `style` and `props.style` pass, as do `null` and `undefined` style expressions. Inside an object, `...floatingStyles`, `...provided.draggableProps.style`, `...style` and `...props.style` pass, but ordinary properties beside them still report. An unknown spread or computed key is `dynamicStyle`, as is a non-object identifier, member, call, string attribute or conditional expression:

```tsx
<div style={floatingStyles} /> // OK
<div style={{ ...floatingStyles, color: 'red' }} /> // color finding
<div style={getStyles()} /> // dynamicStyle: unknown object
<div style={{ ...unknownStyles }} /> // dynamicStyle: unknown spread
```

For a justified exception, place `// design-doctor-ignore no-inline-styles: <reason>` on its own line immediately before the **property** or before the `style` attribute; the report records its scope and reason. Do not suppress a whole attribute to hide unrelated ordinary properties.

## Accuracy limits

- No one-hop resolution of same-file objects, imported values, lookup values or defaults: a non-allowed variable is `dynamicStyle`. A local object named `style` is treated like forwarded `style`; avoid this name for locally authored style objects. The Grit rule cannot cheaply distinguish the two under the lint budget.
- Only literal syntax in a custom-property value is examined; a color stored in another identifier, a call result or an interpolation is not resolved. The color-function check requires literal, non-nested channels. Whitespace and comments in malformed CSS, URLs containing color-looking text and unsupported escape forms may not be interpreted exactly as a CSS parser would. For example, `'--x': 'url(#fade)'` is flagged because `#fade` resembles a hex color; this is not a CSS color in that URL.
- JSX object spreads are not expanded; only the four explicitly allowed paths pass. Assertions around a spread (such as `...(floatingStyles as CSSProperties)`) and optional/non-null forwarded members (`props?.style`, `props.style!`) are not recognized as allowed and are reported. A computed key is unreadable even if its expression is a literal. CSS-in-JS outside JSX `style` attributes and style-element opening tags is outside this rule.
- Subjects of unreadable expressions are flattened to a single line and formatter-added trailing commas before `}`, `]` or `)` are removed. Identical expressions formatted on one or multiple lines therefore retain the same baseline subject.
