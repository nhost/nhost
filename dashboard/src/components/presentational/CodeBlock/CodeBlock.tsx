import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type ReactElement,
} from 'react';
import { getNodeText } from '@/components/presentational/CodeBlock/getNodeText';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { cn } from '@/lib/utils';

export interface CodeBlockPropsBase {
  filename?: string;
  /**
   * Name of the code, used in the "Copy <name>" tooltip and the
   * "<name> copied to clipboard" toast.
   */
  copyToClipboardToastTitle: string;
}

export type CodeBlockProps = CodeBlockPropsBase &
  Omit<ComponentPropsWithoutRef<'div'>, keyof CodeBlockPropsBase>;

function CodeTabBar({
  filename,
  children,
}: {
  filename: string;
  children?: ReactElement;
}) {
  return (
    <div className="flex text-slate-400 text-xs leading-6">
      <div className="flex flex-none items-center border-t border-t-transparent border-b px-4 py-1">
        {filename}
      </div>
      <div className="flex flex-auto items-center rounded-t border border-slate-500/30 bg-codeblock-tabs">
        {children && (
          <div className="flex flex-auto items-center justify-end space-x-4 px-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export const CodeBlock = forwardRef<HTMLDivElement, CodeBlockProps>(
  (
    { filename, children, className, copyToClipboardToastTitle, ...props },
    ref,
  ) => (
    <div
      className={cn(
        'not-prose relative mt-5 w-full min-w-0 max-w-full rounded-md bg-muted px-2 pb-2',
        filename && 'pt-2',
        className,
      )}
      ref={ref}
      {...props}
    >
      {filename ? (
        <CodeTabBar filename={filename}>
          <CopyToClipboardButton
            textToCopy={getNodeText(children)}
            title={copyToClipboardToastTitle}
            className="relative"
          />
        </CodeTabBar>
      ) : (
        <CopyToClipboardButton
          textToCopy={getNodeText(children)}
          title={copyToClipboardToastTitle}
          className="absolute top-3 right-3"
        />
      )}
      <pre className="w-full max-w-full whitespace-pre-wrap break-words pr-10">
        <code className="break-all font-mono">{children}</code>
      </pre>
    </div>
  ),
);
