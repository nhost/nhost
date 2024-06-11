import { clsx } from 'clsx';
import { type ComponentPropsWithoutRef, type ForwardedRef, forwardRef, type ReactElement } from 'react';

import { type CopyToClipboardResult } from './copyToClipboard';
import { getNodeText } from './getNodeText';
import { CopyToClipboardButton as CopyToClipboardButtonOriginal } from './CopyToClipboardButton';
import { Box } from '@/components/ui/v2/Box';

export interface CodeBlockPropsBase {
  filename?: string;
  /**
   *  Color of the filename text and the border underneath it when content is being shown.
   */
  filenameColor?: string;
  /**
   * Background color for the tooltip saying `Click to Copy` when hovering the clipboard button.
   */
  tooltipColor?: string;
  /**
   * The callback function when a user clicks on the copied to clipboard button
   */
  onCopied?: (result: CopyToClipboardResult, textToCopy?: string) => void;
}

export type CodeBlockProps = CodeBlockPropsBase &
  Omit<ComponentPropsWithoutRef<'div'>, keyof CodeBlockPropsBase>;

/**
* Different from CodeGroup because we cannot use Headless UI's Tab component outside a Tab.Group
* Styling should look the same though.
*/
function CodeTabBar({
  filename,
  filenameColor,
  children,
}: {
  filename: string;
  filenameColor?: string;
  children?: ReactElement;
}) {
  return (
    <div className="flex text-slate-400 text-xs leading-6">
      <div
        className="flex-none border-t border-b border-t-transparent px-4 py-1 flex items-center"
        style={{ color: filenameColor, borderBottomColor: filenameColor }}
      >
        {filename}
      </div>
      <div className="flex-auto flex items-center bg-codeblock-tabs border border-slate-500/30 rounded-t">
        {children && (
          <div className="flex-auto flex items-center justify-end px-4 space-x-4">{children}</div>
        )}
      </div>
    </div>
  );
}

interface CopyToClipboardButtonProps extends Partial<ComponentPropsWithoutRef<typeof CopyToClipboardButtonOriginal>> {
  filenameColor?: string;
  tooltipColor?: string;
  onCopied?: (result: CopyToClipboardResult, textToCopy?: string) => void;
}

function CopyToClipboardButton ({
  tooltipColor,
  filenameColor,
  onCopied,
  textToCopy,
  ...props }: CopyToClipboardButtonProps) {
  return (<CopyToClipboardButtonOriginal
    tooltipColor={tooltipColor ?? filenameColor}
    onCopied={onCopied}
    textToCopy={textToCopy}
    {...props}
  />)
};

export const CodeBlock = forwardRef((
  {
    filename,
    filenameColor,
    tooltipColor,
    onCopied,
    children,
    className,
    ...props
  }: CodeBlockProps,
  ref: ForwardedRef<HTMLDivElement>
) => (<Box
    sx={{
      backgroundColor: (theme) => theme.palette.mode === "dark" ? "grey.200" : "grey.200"
    }}
    className={clsx('mt-5 not-prose relative px-2', filename && 'pt-2', className)}
    ref={ref}
    {...props}
  >
    {filename ? (
      <CodeTabBar filename={filename} filenameColor={filenameColor}>
        <CopyToClipboardButton
          filenameColor={filenameColor}
          tooltipColor={tooltipColor}
          onCopied={onCopied}
          textToCopy={getNodeText(children)}
          className="relative" />
      </CodeTabBar>
    ) : (
      <CopyToClipboardButton
        filenameColor={filenameColor}
        textToCopy={getNodeText(children)}
        tooltipColor={tooltipColor}
        onCopied={onCopied}
        className="absolute top-0 right-1" />
    )}
    <pre className="overflow-x-auto"><code className="font-mono"
    >
      {children}
    </code></pre>
  </Box>
));