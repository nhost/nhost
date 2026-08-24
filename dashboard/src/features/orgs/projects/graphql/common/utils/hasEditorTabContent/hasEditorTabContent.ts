export default function hasEditorTabContent(text: string): boolean {
  if (!text.trim()) {
    return false;
  }

  try {
    const parsedContent: unknown = JSON.parse(text);

    return !(
      typeof parsedContent === 'object' &&
      parsedContent !== null &&
      !Array.isArray(parsedContent) &&
      Object.keys(parsedContent).length === 0
    );
  } catch {
    return true;
  }
}
