import { normalizeToIndividualFunctionsWithLogs } from '@/components/applications/functions/normalizeToIndividualFunctionsWithLogs';
import darkTerminalTheme from '@/data/darkTerminalTheme';
import terminalTheme from '@/data/terminalTheme';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Box from '@/ui/v2/Box';
import Text from '@/ui/v2/Text';
import { useGetFunctionLogQuery } from '@/utils/__generated__/graphql';
import { useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/cjs/languages/hljs/json';
import { FunctionLogHistory } from './FunctionLogHistory';

SyntaxHighlighter.registerLanguage('json', json);

export function FunctionsLogsTerminalPage({ functionName }: any) {
  const theme = useTheme();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [normalizedFunctionData, setNormalizedFunctionData] = useState(null);

  const { data, startPolling } = useGetFunctionLogQuery({
    variables: {
      subdomain: currentApplication.subdomain,
      functionPaths: [functionName?.split('/').slice(1, 3).join('/')],
    },
  });

  useEffect(() => {
    startPolling(3000);
  }, [startPolling]);

  useEffect(() => {
    if (!data || data.getFunctionLogs.length === 0) {
      return;
    }

    setNormalizedFunctionData(
      normalizeToIndividualFunctionsWithLogs(data.getFunctionLogs)[0],
    );
  }, [data]);

  if (
    !data ||
    data.getFunctionLogs.length === 0 ||
    !normalizedFunctionData ||
    normalizedFunctionData.logs.length === 0
  ) {
    return (
      <div className="w-full rounded-lg">
        <Box
          className="h-terminal overflow-auto rounded-lg px-4 py-4 font-mono shadow-sm"
          sx={{ backgroundColor: 'grey.200' }}
        >
          <Text className="font-mono text-xs" color="disabled">
            There are no stored logs yet. Try calling your function for logs to
            appear.
          </Text>
        </Box>
        <FunctionLogHistory />
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg">
      <Box
        className="h-terminal overflow-auto rounded-lg px-6 py-2 font-mono shadow-sm"
        sx={{ backgroundColor: 'grey.200' }}
      >
        {normalizedFunctionData?.logs?.map((log) => (
          <div
            key={`${log.date}-${log.message.slice(66)}`}
            className=" flex text-sm"
          >
            <div id={`#-${log.date}`}>
              <pre className="inline">
                <Text component="span" className="mr-4" color="disabled">
                  {log.date}
                </Text>{' '}
                <span>
                  <SyntaxHighlighter
                    style={
                      theme.palette.mode === 'dark'
                        ? darkTerminalTheme
                        : terminalTheme
                    }
                    customStyle={{
                      display: 'inline',
                    }}
                    className="inline-flex"
                    language="json"
                  >
                    {log.message}
                  </SyntaxHighlighter>
                </span>
              </pre>
            </div>
          </div>
        ))}
      </Box>
      <FunctionLogHistory logs={normalizedFunctionData?.logs} />
    </div>
  );
}

export default FunctionsLogsTerminalPage;
