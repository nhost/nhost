import { type DocumentNode, valueFromASTUntyped, visit } from 'graphql';
import {
  DashboardSupportAttachmentDraftDocument,
  DashboardSupportAttachmentsDocument,
} from '@/generated/graphql';
import {
  attachmentValidationError,
  SUPPORT_ATTACHMENT_BUCKET,
  supportAttachmentId,
  supportAttachmentIds,
  supportAttachmentMarkdown,
} from './attachments';

function attachmentFilters(document: DocumentNode): unknown[] {
  const filters: unknown[] = [];
  visit(document, {
    Field(node) {
      if (node.name.value === 'attachments') {
        const argument = node.arguments?.find(
          (item) => item.name.value === 'where',
        );
        filters.push(
          argument ? valueFromASTUntyped(argument.value) : undefined,
        );
      }
    },
  });
  return filters;
}

describe('completed attachment queries', () => {
  it.each([
    { target: 'ticket', document: DashboardSupportAttachmentsDocument },
    { target: 'draft', document: DashboardSupportAttachmentDraftDocument },
  ])(
    'filters $target reservations to retained completed files in the private bucket',
    ({ document }) => {
      expect(attachmentFilters(document)).toEqual([
        {
          discardedAt: { _is_null: true },
          file: {
            bucketId: { _eq: SUPPORT_ATTACHMENT_BUCKET },
            isUploaded: { _eq: true },
          },
        },
      ]);
    },
  );
});

describe('support attachment Markdown', () => {
  const id = '41261576-2d59-4c12-bc6e-e573bdba3af1';
  it.each(['image/png', 'image/jpeg', 'image/svg+xml'])(
    'inserts %s as image Markdown without a public URL',
    (mimeType) => {
      expect(
        supportAttachmentMarkdown({ id, name: 'Screenshot', mimeType }),
      ).toBe(`![Screenshot](attachment:${id})`);
    },
  );
  it('escapes file names rather than letting them inject Markdown links', () => {
    expect(
      supportAttachmentMarkdown({
        id,
        name: 'logs [x]\n!.txt',
        mimeType: 'text/plain',
      }),
    ).toBe(`[logs \\[x\\] \\!.txt](attachment:${id})`);
  });
  it('recognizes only exact private attachment references', () => {
    expect(supportAttachmentId(`attachment:${id}`)).toBe(id);
    for (const url of [
      `https://example.com/${id}`,
      `blob:${id}`,
      `attachment:${id}/extra`,
      `attachment:${id}?token=secret`,
      'attachment:invalid',
    ]) {
      expect(supportAttachmentId(url)).toBeUndefined();
    }
  });
  it('collects the attachment IDs a description links to', () => {
    const other = '7d442aba-6e61-4854-b354-0d5ec8d198d8';
    expect(
      supportAttachmentIds(
        `See [logs](attachment:${id}) and ![shot](attachment:${other}), [again](attachment:${id}), [bad](attachment:invalid) and [web](https://example.com/${id}).`,
      ),
    ).toEqual(new Set([id, other]));
  });
});

describe('support attachment validation', () => {
  it.each([1, 5_000_000])('accepts a %i-byte file', (size) => {
    expect(
      attachmentValidationError(
        new File([new Uint8Array(size)], 'diagnostic.txt'),
      ),
    ).toBeUndefined();
  });
  it.each([
    { size: 0, message: 'Empty files cannot be attached.' },
    { size: 5_000_001, message: 'Files must be 5 MB or smaller.' },
  ])('rejects a $size-byte file', ({ size, message }) => {
    expect(
      attachmentValidationError(
        new File([new Uint8Array(size)], 'diagnostic.txt'),
      ),
    ).toBe(message);
  });
});
