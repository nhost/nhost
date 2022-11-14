import { Text } from '@/ui/Text';
import { ChevronRightIcon } from '@heroicons/react/solid';
import { formatDistance } from 'date-fns';

export interface FunctionLogDataEntryProps {
  time: string;
  nav: string;
}

export function FunctionLogDataEntry({ time, nav }: FunctionLogDataEntryProps) {
  return (
    <a href={`#${nav}`}>
      <div className="flex cursor-pointer flex-row place-content-between border-t py-3">
        <Text
          color="greyscaleDark"
          variant="body"
          className="flex font-medium"
          size="tiny"
        >
          {formatDistance(new Date(time), new Date(), {
            addSuffix: true,
          })}
        </Text>
        <ChevronRightIcon className="ml-2 h-4 w-4 cursor-pointer self-center text-greyscaleDark" />
      </div>
    </a>
  );
}

export default FunctionLogDataEntry;
