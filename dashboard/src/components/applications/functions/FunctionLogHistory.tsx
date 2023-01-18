import Divider from '@/ui/v2/Divider';
import List from '@/ui/v2/List';
import Text from '@/ui/v2/Text';
import { Fragment } from 'react';
import { FunctionLogDataEntry } from './FunctionLogDataEntry';

export interface FunctionLogHistoryProps {
  logs?: Log[];
}

type Log = {
  createdAt: string;
  date: any;
  message: string;
};

export function FunctionLogHistory({ logs }: FunctionLogHistoryProps) {
  return (
    <div className=" mx-auto max-w-6xl pt-10">
      <div className="flex flex-row place-content-between">
        <div className="flex">
          <Text className="font-medium text-xl">Log History</Text>
        </div>
      </div>
      <div className="mt-5 grid grid-flow-row gap-1">
        <Text className="font-semibold">Time</Text>

        <div className="flex flex-col">
          {logs ? (
            <List>
              <Divider component="li" />
              {logs.slice(0, 4).map((log: Log) => (
                <Fragment key={`${log.date}-${log.message}`}>
                  <FunctionLogDataEntry
                    time={log.createdAt}
                    nav={`#-${log.date}`}
                    key={`${log.date}-${log.message.slice(66)}`}
                  />
                  <Divider component="li" />
                </Fragment>
              ))}
            </List>
          ) : (
            <Text className="pt-1 pl-0.5 font-mono text-xs">
              No log history.
            </Text>
          )}
        </div>
      </div>
    </div>
  );
}

export default FunctionLogHistory;
