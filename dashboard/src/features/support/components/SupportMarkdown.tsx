import { memo, useMemo } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SupportEditorAttachment from '@/features/support/components/SupportEditorAttachment';
import { useSupportTicketAttachmentList } from '@/features/support/hooks/useSupportTicketAttachments';
import { supportAttachmentId } from '@/features/support/utils/attachments';

interface SupportMarkdownProps {
  children: string;
  ticketId?: string;
}

function SupportMarkdown({ children, ticketId }: SupportMarkdownProps) {
  // Messages mount as replies arrive; the list itself stays current through
  // the ticket subscription, so mounting a message doesn't refetch it.
  const attachments = useSupportTicketAttachmentList(ticketId, false);
  const files = useMemo(
    () =>
      new Map(
        (attachments.isError ? [] : (attachments.data ?? [])).map(
          (attachment) => [attachment.id as string, attachment.file],
        ),
      ),
    [attachments.data, attachments.isError],
  );
  function resolve(id: string) {
    return {
      file: files.get(id) ?? undefined,
      loading: attachments.isLoading,
    };
  }
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:overflow-x-auto break-words prose-td:break-words [overflow-wrap:anywhere]">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) =>
          supportAttachmentId(url) ? url : defaultUrlTransform(url)
        }
        components={{
          a: ({ href, children: label }) => {
            const id = href ? supportAttachmentId(href) : undefined;
            if (id) {
              return ticketId ? (
                <SupportEditorAttachment
                  id={id}
                  scope={{ ticketId }}
                  name={typeof label === 'string' ? label : 'Attachment'}
                  resolved={resolve(id)}
                  compact
                />
              ) : (
                <span>{label}</span>
              );
            }
            return href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ) : (
              <span>{label}</span>
            );
          },
          img: ({ src, alt }) => {
            const id =
              typeof src === 'string' ? supportAttachmentId(src) : undefined;
            return id && ticketId ? (
              <SupportEditorAttachment
                id={id}
                scope={{ ticketId }}
                name={alt || 'Image'}
                resolved={resolve(id)}
                compact
                reserveThumbnail
              />
            ) : (
              <span>[Image: {alt || 'image'}]</span>
            );
          },
          p: ({ children: content }) => (
            <p className="whitespace-pre-wrap">{content}</p>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}

export default memo(SupportMarkdown);
