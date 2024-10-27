import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Text } from '@/components/ui/v2/Text';
import { copy } from '@/utils/copy';
import type { ReactNode } from 'react';

export interface InfoCardProps extends BoxProps {
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
    <Box
      className="grid grid-flow-col place-content-between items-center gap-1 rounded-lg p-3 shadow-sm"
      sx={{ backgroundColor: 'grey.200' }}
      {...props}
    >
      <Text className="text-sm+ font-medium">{title}</Text>

      <div className="grid grid-flow-col items-center gap-1 self-center">
        {customValue || (
          <Text className="truncate text-sm font-medium">{value}</Text>
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
    </Box>
  );
}
