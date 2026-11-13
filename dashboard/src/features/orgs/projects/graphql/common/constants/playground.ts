// Icon only buttons in the playground: muted icon that turns primary on hover.
// GraphiQL's legacy stylesheet colors every button inside it, so the color is
// set on the icon instead of the button.
export const PLAYGROUND_ICON_BUTTON_CLASSES =
  'h-10 w-10 [&_svg]:text-muted-foreground [&_svg]:transition-colors [&:hover_svg]:text-primary';

// Section titles inside the side panel (Starred, Recent, Root types, Tables,
// Other types, Fields…). Same uppercase idea as the main menu's section
// titles, a size up so they're easy to read in the panel. The Docs titles that
// come from GraphiQL get the same style in globals.css.
export const PLAYGROUND_SECTION_TITLE_CLASSES =
  'font-semibold text-muted-foreground text-xs uppercase tracking-[0.06em]';
