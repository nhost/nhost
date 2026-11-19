// An attribute list, read quote by quote, since Tailwind classes such as
// `has-[>svg]:px-3` hold a `>`.
const ATTRIBUTES = `(?:[^>"]|"[^"]*")*?`;

/** The href of the link whose text is `label`, in server-rendered markup. */
export function hrefOf(html: string, label: string): string | undefined {
  const text = html.replaceAll('<!---->', '');
  return new RegExp(
    String.raw`<a\s${ATTRIBUTES}href="([^"]*)"${ATTRIBUTES}>\s*${label}\s*</a>`,
  ).exec(text)?.[1];
}
