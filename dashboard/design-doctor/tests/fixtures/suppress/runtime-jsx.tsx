const children = (
  <div>
    {/**
     * biome-ignore lint/suspicious/noExplicitAny: unrelated category
     * biome-ignore lint/plugin/no-reinvented-components: plugin second
     */}
    <button type="button">jsx second</button>
    {/**
     * design-doctor-ignore no-reinvented-components: unused due to Biome
     * biome-ignore lint/plugin: plugin second
     */}
    <button type="button">jsx mixed</button>
    {/* biome-ignore lint/plugin: JSX expression container */}
    <button type="button">jsx single</button>
  </div>
);
export { children };
