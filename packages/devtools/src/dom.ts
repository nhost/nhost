const SVG_NS = 'http://www.w3.org/2000/svg';

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

export function svgElement(
  tag: string,
  attributes: Record<string, string> = {},
): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

/**
 * Replace an element's inline style outright.
 *
 * The anchored pieces name different properties on different edges: the card
 * sits on `left` against the left edge and on `right` against the right one.
 * Patching would leave the old side set and pin the card to both, so the
 * declarations are cleared before the new ones go on. Nothing styled this way
 * carries inline declarations from anywhere else.
 */
export function setStyles(
  node: HTMLElement | SVGElement,
  styles: Record<string, string>,
): void {
  node.style.cssText = '';
  for (const [property, value] of Object.entries(styles)) {
    node.style.setProperty(property, value);
  }
}
