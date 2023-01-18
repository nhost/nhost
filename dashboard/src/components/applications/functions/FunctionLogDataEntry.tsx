import ChevronRightIcon from '@/ui/v2/icons/ChevronRightIcon';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import { formatDistance } from 'date-fns';

export interface FunctionLogDataEntryProps {
  time: string;
  nav: string;
}

export function FunctionLogDataEntry({ time, nav }: FunctionLogDataEntryProps) {
  return (
    <ListItem.Root>
      <ListItem.Button
        className="flex flex-row place-content-between py-3 rounded-none"
        href={`#${nav}`}
      >
        <Text className="flex font-medium text-xs">
          {formatDistance(new Date(time), new Date(), {
            addSuffix: true,
          })}
        </Text>

        <ChevronRightIcon className="ml-2 h-4 w-4" />
      </ListItem.Button>
    </ListItem.Root>
  );
}

export default FunctionLogDataEntry;
