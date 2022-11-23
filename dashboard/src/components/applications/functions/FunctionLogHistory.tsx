import { Text } from '@/ui/Text';
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
          <Text size="large" className="font-medium" color="greyscaleDark">
            Log History
          </Text>
        </div>
      </div>
      <div className="mt-5 flex flex-col">
        <div className="flex flex-row">
          <Text className="font-semibold" size="normal" color="greyscaleDark">
            Time
          </Text>
        </div>
        <div className="flex flex-col">
          {logs ? (
            <div>
              {logs.slice(0, 4).map((log: Log) => (
                <FunctionLogDataEntry
                  time={log.createdAt}
                  nav={`#-${log.date}`}
                  key={`${log.date}-${log.message.slice(66)}`}
                />
              ))}
            </div>
          ) : (
            <div className="pt-1 pl-0.5 font-mono text-xs text-greyscaleDark">
              No log history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FunctionLogHistory;
