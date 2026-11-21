import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SupportInlineAttachment from '@/features/support/components/SupportInlineAttachment';
import {
  type SupportAttachmentScope,
  supportAttachmentId,
} from '@/features/support/utils/attachments';

interface SupportMarkdownProps {
  children: string;
  attachmentScope?: SupportAttachmentScope;
}

export default function SupportMarkdown({
  children,
  attachmentScope,
}: SupportMarkdownProps) {
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
              return attachmentScope ? (
                <SupportInlineAttachment id={id} scope={attachmentScope}>
                  {label}
                </SupportInlineAttachment>
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
            return id && attachmentScope ? (
              <SupportInlineAttachment id={id} scope={attachmentScope} image>
                {alt || 'image'}
              </SupportInlineAttachment>
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
