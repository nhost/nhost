export type CopyToClipboardResult = 'success' | 'error';

export async function copyToClipboard(text: string): Promise<CopyToClipboardResult> {
  if (!text) {
    console.warn('Called copyToClipboard() with empty text');
  }

  if (!navigator.clipboard) {
    console.error(
      'The Clipboard API was unavailable. The Clipboard API is only available client-side in browsers using HTTPS.'
    );
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'success';
  } catch (err) {
    console.error('Failed to copy: ', err);
    return 'error';
  }
}