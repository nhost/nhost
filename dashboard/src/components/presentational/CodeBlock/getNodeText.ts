// Gets the text from a component as if you selected it with a mouse and copied it.
export const getNodeText = (node: any): string => {
  if (['string', 'number'].includes(typeof node)) {
    // Convert number into string
    return node.toString();
  }

  if (node instanceof Array) {
    return node.map(getNodeText).join('');
  }

  if (typeof node === 'object' && node?.props?.children) {
    return getNodeText(node.props.children);
  }

  return '';
};
