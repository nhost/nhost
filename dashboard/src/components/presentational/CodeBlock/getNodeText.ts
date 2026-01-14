// Gets the text from a component as if you selected it with a mouse and copied it.
// biome-ignore lint/suspicious/noExplicitAny: TODO
export const getNodeText = (node: any): string => {
  if (['string', 'number'].includes(typeof node)) {
    // Convert number into string
    return node.toString();
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join('');
  }

  if (typeof node === 'object' && node?.props?.children) {
    return getNodeText(node.props.children);
  }

  return '';
};
