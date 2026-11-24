const control = <button type="button">control</button>; // expect: no-reinvented-components "button"
/*␍ biome-ignore lint/plugin: lone CR inside a block comment␍ */
const hidden = <button type="button">hidden</button>;
/*
 note␍ biome-ignore lint/plugin: not a separate directive in Biome
 */
const visible = <button type="button">visible</button>; // expect: no-reinvented-components "button"
export { control, hidden, visible };
