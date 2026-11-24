const multilevel = (
  <section>
    {/* design-doctor-ignore no-reinvented-components: legacy nested controls */}
    <button
      type="button"
    >
      <button type="button">Nested</button>
    </button>
    <button type="button">Adjacent</button>
    {/* design-doctor-ignore no-reinvented-components: first rule */}
    {/* design-doctor-ignore no-direct-radix-imports: second rule */}
    <button type="button">Stacked</button>
  </section>
);
const attributes = (
  <div
    // design-doctor-ignore no-reinvented-components: localized attribute
    data-note="😀 label"
    // design-doctor-ignore no-reinvented-components: empty attribute
    aria-label="No finding"
  />
);
const properties = {
  /* design-doctor-ignore no-direct-radix-imports: property is exceptional */
  thing: 'property',
  /* design-doctor-ignore no-direct-radix-imports: redundant */
  /* design-doctor-ignore no-direct-radix-imports: duplicate */
  other: 'duplicate',
};
// design-doctor-ignore unknown-rule: unsupported rule
const unknown = 1;
// design-doctor-ignore no-direct-radix-imports:
const missingReason = 1;
// design-doctor-ignore no-direct-radix-imports: orphan
// biome-ignore lint/plugin: would hide all design diagnostics
// biome-ignore-all lint/plugin/no-reinvented-components: would hide one rule
// biome-ignore-start lint/plugin/no-direct-radix-imports: would hide one rule
// biome-ignore-end lint/plugin/no-direct-radix-imports: closes the range, not a new suppression
// biome-ignore-all lint: would hide every design rule
// biome-ignore-start lint: would hide every design rule
// biome-ignore lint/style: non-design category
// biome-ignore lint/style/useSomething: non-plugin rule
const trailing = 1;
const inline = 1; /* design-doctor-ignore no-reinvented-components: inline not leading */
const afterInline = 2;
const text = 'biome-ignore lint/plugin and design-doctor-ignore no-direct-radix-imports: not a comment';
const jsxText = <p>biome-ignore lint/plugin is just JSX text</p>;
export { multilevel, attributes, properties, unknown, missingReason, trailing, inline, afterInline, text, jsxText };
const inlineJsx = <div>😀{/* design-doctor-ignore no-reinvented-components: inline JSX is invalid */}<button /></div>;
const bareLintJsx = (
  <div>
    {/* biome-ignore lint: hides design diagnostics in JSX */}
    <button />
  </div>
);
const emojiSiblings = (
  <div>
    {/* design-doctor-ignore no-reinvented-components: only the emoji sibling */}
    <b>😀😀😀😀😀😀😀😀</b><button type="button">after</button>
  </div>
);
/** biome-ignore-all lint/plugin: hides every design rule */
const jsdocBiome = 1;
const jsxJsdocBiome = (
  <div>
    {/** biome-ignore lint/plugin/no-reinvented-components(button): hides button findings */}
    <button type="button">Biome JSDoc</button>
  </div>
);
/**
 * Wrapper notes.
 * biome-ignore lint/plugin: hides plugin findings
 */
const laterBiome = 1;
/** biome-ignore-all lint/style: ordinary linter category */
const otherCategory = 1;
/** design-doctor-ignore no-direct-radix-imports: legacy statement */
const jsdocStatement = 1;
const jsxJsdocDesign = (
  <div>
    {/** design-doctor-ignore no-reinvented-components: legacy child */}
    <button type="button">Doctor JSDoc</button>
  </div>
);
/**
 * Wrapper notes.
 * design-doctor-ignore no-direct-radix-imports: legacy multiline statement
 */
const laterDesign = 1;
/**
 * biome-ignore lint/suspicious/noExplicitAny: unrelated category
 * biome-ignore lint/plugin: hidden import
 */
const secondBiomeImport = 1;
const secondBiomeJsx = (
  <div>
    {/**
     * biome-ignore lint/suspicious/noExplicitAny: unrelated category
     * biome-ignore lint/plugin/no-reinvented-components: hidden child
     */}
    <button type="button">Second plugin line</button>
  </div>
);
/**
 * design-doctor-ignore no-direct-radix-imports: recorded despite hidden finding
 * biome-ignore lint/plugin: hidden import
 */
const mixedDirectives = 1;
/**
 * design-doctor-ignore no-direct-radix-imports: first directive
 * design-doctor-ignore no-reinvented-components: second directive is invalid
 */
const twoDoctorLines = 1;
export { secondBiomeImport, secondBiomeJsx, mixedDirectives, twoDoctorLines };
