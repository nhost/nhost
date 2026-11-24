const control = <button type="button">control</button>; // expect: no-reinvented-components "button"
  //  biome-ignore lint/plugin: single-line comment with leading space
const slash = <button type="button">slash</button>;
  /*  biome-ignore lint/plugin: block with leading space */
const block = <button type="button">block</button>;
/** biome-ignore lint/plugin: JSDoc */
const jsdoc = <button type="button">jsdoc</button>;
/**
 * biome-ignore lint/suspicious/noExplicitAny: unrelated category
 * biome-ignore lint/plugin: plugin on the second line
 */
const second = <button type="button">second</button>;
/**
 * biome-ignore lint/plugin: plugin on the first line
 * biome-ignore lint/suspicious/noExplicitAny: unrelated category
 */
const first = <button type="button">first</button>;
/**
 * biome-ignore lint/plugin: first plugin directive
 * biome-ignore lint/plugin/no-reinvented-components: second plugin directive
 */
const both = <button type="button">both</button>;
// biome-ignore lint/plugin/no-reinvented-components(hover:bg-red-500): legacy
const parameterizedRule = <button type="button">parameterized rule</button>;
// biome-ignore lint/plugin(hover:bg-red-500): legacy
const parameterizedPlugin = <button type="button">parameterized plugin</button>;
// biome-ignore lint(hover:x): legacy
const parameterizedLint = <button type="button">parameterized lint</button>;
// biome-ignore-start lint/plugin: range without a matching end
const range = <button type="button">range</button>;
export { control, slash, block, jsdoc, second, first, both, range, parameterizedRule, parameterizedPlugin, parameterizedLint };
