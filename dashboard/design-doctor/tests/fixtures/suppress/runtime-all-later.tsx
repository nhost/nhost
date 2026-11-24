const before = 1;
// biome-ignore-all lint/plugin: incorrect placement still invalid
const later = <button type="button">later</button>; // expect: no-reinvented-components "button"
export { before, later };
