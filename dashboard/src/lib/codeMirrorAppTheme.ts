import { EditorView, Prec } from '@uiw/react-codemirror';

/**
 * Overrides the background chrome (editor surface, gutters, active line) of
 * the vendored GitHub CodeMirror themes so embedded code editors match the
 * app's own background instead of GitHub's own dark navy/light palette.
 * Syntax highlighting colors from `githubDark`/`githubLight` are untouched;
 * only surface colors are replaced with the app's CSS variables, so this
 * automatically tracks light/dark mode. Wrapped in `Prec.highest` so it wins
 * over the base theme's own background rules.
 */
export const codeMirrorAppBackground = Prec.highest(
  EditorView.theme({
    '&': {
      backgroundColor: 'hsl(var(--background))',
    },
    '.cm-scroller': {
      backgroundColor: 'hsl(var(--background))',
    },
    '.cm-gutters': {
      backgroundColor: 'hsl(var(--background))',
      borderRight: '1px solid hsl(var(--border))',
    },
    '.cm-activeLine': {
      backgroundColor: 'hsl(var(--muted) / 0.4)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'hsl(var(--muted) / 0.4)',
    },
  }),
);

/**
 * In dark mode, puts the code a step darker than the page, on the console
 * background, so it reads as its own surface under a card header. List it
 * before `codeMirrorAppBackground` so it wins over it: at the same precedence,
 * earlier wins, because EditorView mounts theme styles in reverse order.
 */
export const codeMirrorConsoleBackground = Prec.highest(
  EditorView.theme({
    '&, .cm-scroller, .cm-gutters': {
      backgroundColor: 'hsl(var(--console-background))',
    },
  }),
);
