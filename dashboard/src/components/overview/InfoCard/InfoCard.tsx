import IconButton from '@/ui/v2/IconButton';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Text from '@/ui/v2/Text';
import { copy } from '@/utils/copy';
import type { DetailedHTMLProps, HTMLProps, ReactNode } from 'react';

export interface InfoCardProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * The title of the card.
   */
  title: string;
  /**
   * The description of the card.
   */
  value: string;
  /**
   * Include a copy button and functionality.
   * @default false
   */
  disableCopy?: boolean;
  /**
   * Pass a custom component to render the card as a value.
   */
  customValue?: ReactNode;
}

export default function InfoCard({
  title,
  value,
  disableCopy = false,
  customValue,
  ...props
}: InfoCardProps) {
  return (
    <div
      className="flex flex-row place-content-between rounded-lg bg-card p-3 shadow-sm"
      {...props}
    >
      <div className="flex self-center truncate align-middle">
        <Text
          className="text-sm+ font-medium text-greyscaleDark"
          lineHeight="22px"
        >
          {title}
        </Text>
      </div>
      <div className="grid grid-flow-col items-center gap-1 self-center">
        {customValue || (
          <Text className="text-sm font-medium text-greyscaleDark">
            {value}
          </Text>
        )}

        {!disableCopy && (
          <IconButton
            variant="borderless"
            color="secondary"
            onClick={(event) => {
              event.stopPropagation();

              copy(value, title);
            }}
            aria-label={value}
          >
            <CopyIcon className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    </div>
  );
}
