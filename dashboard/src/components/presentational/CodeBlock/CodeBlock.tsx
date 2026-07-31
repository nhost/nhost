import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type ReactElement,
} from 'react';
import { getNodeText } from '@/components/presentational/CodeBlock/getNodeText';
import { CopyToClipboardButton as CopyToClipboardButtonOriginal } from '@/components/presentational/CopyToClipboardButton';
import { cn } from '@/lib/utils';

export interface CodeBlockPropsBase {
  filename?: string;
  /**
   * Text of the toast that appears when the code is copied to the clipboard.
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

interface CopyToClipboardButtonProps
  extends Partial<
    ComponentPropsWithoutRef<typeof CopyToClipboardButtonOriginal>
  > {
  toastTitle: string;
}

function CopyToClipboardButton({
  textToCopy,
  toastTitle,
  ...props
}: CopyToClipboardButtonProps) {
  return (
    <CopyToClipboardButtonOriginal
      textToCopy={textToCopy}
      title={toastTitle}
      {...props}
    />
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
            toastTitle={copyToClipboardToastTitle}
            className="relative"
          />
        </CodeTabBar>
      ) : (
        <CopyToClipboardButton
          textToCopy={getNodeText(children)}
          toastTitle={copyToClipboardToastTitle}
          className="absolute top-3 right-3"
        />
      )}
      <pre className="w-full max-w-full whitespace-pre-wrap break-words pr-10">
        <code className="break-all font-mono">{children}</code>
      </pre>
    </div>
  ),
);
