import { z } from 'zod';

export interface SupportAttachmentFile {
  id: string;
  name?: string | null;
  mimeType?: string | null;
}

export type SupportAttachmentUploaded = (
  attachment: SupportAttachmentFile,
  source: File,
) => void;

export type SupportAttachmentScope =
  | { ticketId: string; draftId?: never }
  | { draftId: string; ticketId?: never };

export function supportAttachmentId(url: string): string | undefined {
  if (!url.startsWith('attachment:')) {
    return undefined;
  }
  const id = url.slice('attachment:'.length);
  return z.uuid().safeParse(id).success ? id : undefined;
}

export function supportAttachmentMarkdown(file: SupportAttachmentFile): string {
  const label = (file.name || 'attachment')
    .replace(/[\r\n]/g, ' ')
    .replace(/[\\[\]`*_<>!]/g, '\\$&');
  return `${file.mimeType?.startsWith('image/') ? '!' : ''}[${label}](attachment:${file.id})`;
}

export function isSupportImage(mimeType: string): boolean {
  return [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/avif',
  ].includes(mimeType);
}

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
  // Downloads always use an inert MIME type, including files that support image previews.
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
