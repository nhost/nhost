export const SUPPORT_ATTACHMENT_BUCKET = 'support_tickets_attachments';
export const MAX_SUPPORT_ATTACHMENT_SIZE = 5_000_000;

export function attachmentValidationError(file: File): string | undefined {
  if (file.size === 0) {
    return 'Empty files cannot be attached.';
  }
  if (file.size > MAX_SUPPORT_ATTACHMENT_SIZE) {
    return 'Files must be 5 MB or smaller.';
  }
  return undefined;
}

export function saveSupportAttachment(blob: Blob, filename: string): void {
  // Never navigate to or embed untrusted attachment content in the dashboard.
  const url = URL.createObjectURL(
    new Blob([blob], { type: 'application/octet-stream' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.split(/[\\/]/).pop() || 'attachment';
  document.body.append(link);
  link.click();
  link.remove();
  // Safari may not have started consuming the blob when click() returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
