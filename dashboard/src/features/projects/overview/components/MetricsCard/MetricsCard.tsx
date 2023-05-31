import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { twMerge } from 'tailwind-merge';

export interface MetricsCardProps extends BoxProps {
  /**
   * Label of the card.
   */
  label?: string;
  /**
   * Value of the card.
   */
  value?: string;
  /**
   * Tooltip of the card.
   */
  tooltip?: string;
}

export default function MetricsCard({
  label,
  value,
  tooltip,
  className,
}: MetricsCardProps) {
  return (
    <Box
      className={twMerge(
        'grid grid-flow-row gap-2 rounded-md px-4 py-3',
        className,
      )}
      sx={{ backgroundColor: 'grey.200' }}
    >
      <div className="grid grid-flow-col items-center justify-between gap-2">
        {label && (
          <Text className="truncate font-medium" color="secondary">
            {label}
          </Text>
        )}

        {tooltip && (
          <Tooltip title={tooltip}>
            <InfoIcon className="h-4 w-4" />
          </Tooltip>
        )}
      </div>

      {value && (
        <Text variant="h2" component="p" className="truncate">
          {value}
        </Text>
      )}
    </Box>
  );
}
