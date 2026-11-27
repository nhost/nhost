import { EditorView } from '@uiw/react-codemirror';
import { act } from '@/tests/testUtils';

// jsdom has no text layout, but CodeMirror measures DOM ranges after edits.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

export function editorView(element: HTMLElement): EditorView {
  const view = EditorView.findFromDOM(element);
  if (!view) {
    throw new Error('Expected a CodeMirror editor.');
  }
  return view;
}

export function editorValue(element: HTMLElement): string {
  return editorView(element).state.doc.toString();
}

export function selectEditorText(
  element: HTMLElement,
  from: number,
  to = from,
) {
  act(() => {
    editorView(element).dispatch({ selection: { anchor: from, head: to } });
    editorView(element).focus();
  });
}

export function expectInputValue(element: HTMLElement, expected: string) {
  if (element.classList.contains('cm-content')) {
    expect(editorValue(element)).toBe(expected);
  } else {
    expect(element).toHaveValue(expected);
  }
}
