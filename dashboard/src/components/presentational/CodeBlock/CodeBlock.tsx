import { clsx } from 'clsx';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  type ReactElement,
} from 'react';

import { Box } from '@/components/ui/v2/Box';
import { CopyToClipboardButton as CopyToClipboardButtonOriginal } from './CopyToClipboardButton';
import { getNodeText } from './getNodeText';

export interface CodeBlockPropsBase {
  filename?: string;
  /**
   *  Color of the filename text and the border underneath it when content is being shown.
   */
  filenameColor?: string;
  /**
   * Text of the toast that appears when the code is copied to the clipboard.
   */
  copyToClipboardToastTitle?: string;
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
    <div className="flex text-xs leading-6 text-slate-400">
      <div
        className="flex flex-none items-center border-b border-t border-t-transparent px-4 py-1"
        style={{ color: filenameColor, borderBottomColor: filenameColor }}
      >
        {filename}
      </div>
      <div className="bg-codeblock-tabs flex flex-auto items-center rounded-t border border-slate-500/30">
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
  filenameColor?: string;
  tooltipColor?: string;
  toastTitle?: string;
}

function CopyToClipboardButton({
  tooltipColor,
  filenameColor,
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

export const CodeBlock = forwardRef(
  (
    {
      filename,
      filenameColor,
      children,
      className,
      copyToClipboardToastTitle,
      ...props
    }: CodeBlockProps,
    ref: ForwardedRef<HTMLDivElement>,
  ) => (
    <Box
      sx={{
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? 'grey.200' : 'grey.200',
      }}
      className={clsx(
        'not-prose relative mt-5 px-2',
        filename && 'pt-2',
        className,
      )}
      ref={ref}
      {...props}
    >
      {filename ? (
        <CodeTabBar filename={filename} filenameColor={filenameColor}>
          <CopyToClipboardButton
            filenameColor={filenameColor}
            textToCopy={getNodeText(children)}
            toastTitle={copyToClipboardToastTitle}
            className="relative"
          />
        </CodeTabBar>
      ) : (
        <CopyToClipboardButton
          filenameColor={filenameColor}
          textToCopy={getNodeText(children)}
          toastTitle={copyToClipboardToastTitle}
          className="absolute right-3 top-0"
        />
      )}
      <pre className="overflow-x-auto">
        <code className="font-mono">{children}</code>
      </pre>
    </Box>
  ),
);
