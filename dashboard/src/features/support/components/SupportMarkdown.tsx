import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SupportMarkdownProps {
  children: string;
}

export default function SupportMarkdown({ children }: SupportMarkdownProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:overflow-x-auto break-words prose-td:break-words [overflow-wrap:anywhere]">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children: label }) =>
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ) : (
              <span>{label}</span>
            ),
          img: ({ alt }) => <span>[Image: {alt || 'image'}]</span>,
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
