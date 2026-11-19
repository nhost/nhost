// Prefixes root-relative links in Markdown/MDX content with Astro's `base`.
//
// Astro only applies `base` to URLs it generates itself (sidebar, assets), so
// hand-written links such as `[Auth](/products/auth)` or
// `<Card href="/products/auth">` would escape the base path. Code blocks are
// plain text in the tree and are left untouched.

const URL_ATTRIBUTES = new Set(['href', 'src']);

/** @param {{ base: string }} options */
export default function rehypeBaseLinks({ base }) {
  const prefix = base.replace(/\/$/, '');

  /** @param {unknown} value */
  const withBase = (value) => {
    if (
      !prefix ||
      typeof value !== 'string' ||
      !value.startsWith('/') ||
      value.startsWith('//') ||
      value === prefix ||
      value.startsWith(`${prefix}/`) ||
      value.startsWith(`${prefix}#`)
    ) {
      return value;
    }
    return value === '/' ? prefix : `${prefix}${value}`;
  };

  /** @param {any} node */
  const visit = (node) => {
    if (node.type === 'element' && node.properties) {
      for (const name of URL_ATTRIBUTES) {
        if (name in node.properties) {
          node.properties[name] = withBase(node.properties[name]);
        }
      }
    }

    if (
      (node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement') &&
      node.attributes
    ) {
      for (const attribute of node.attributes) {
        if (
          attribute.type === 'mdxJsxAttribute' &&
          URL_ATTRIBUTES.has(attribute.name)
        ) {
          attribute.value = withBase(attribute.value);
        }
      }
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  };

  return visit;
}
