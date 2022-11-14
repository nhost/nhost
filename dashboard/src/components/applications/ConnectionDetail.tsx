import IconButton from '@/ui/v2/IconButton';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Text from '@/ui/v2/Text';
import { copy } from '@/utils/copy';

interface ConnectionDetailProps {
  title: string;
  value: string;
}

export function ConnectionDetail({ title, value }: ConnectionDetailProps) {
  return (
    <div className="grid w-full grid-cols-1 place-content-between items-center py-2 sm:grid-cols-3">
      <Text className="col-span-1 text-center font-medium sm:justify-start sm:text-left">
        {title}
      </Text>

      <div className="col-span-1 grid grid-flow-col items-center justify-center gap-2 sm:col-span-2 sm:justify-end">
        <Text className="font-medium" variant="subtitle2">
          {Array(value.length).fill('•').join('')}
        </Text>

        <IconButton
          onClick={() => copy(value, 'Hasura admin secret')}
          variant="borderless"
          color="secondary"
          className="min-w-0 p-1"
          aria-label="Copy admin secret"
        >
          <CopyIcon className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

export default ConnectionDetail;
