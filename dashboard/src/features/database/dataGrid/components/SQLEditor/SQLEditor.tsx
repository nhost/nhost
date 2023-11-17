import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlayIcon } from '@/components/ui/v2/icons/PlayIcon';
import { Switch } from '@/components/ui/v2/Switch';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useState } from 'react';

export default function SQLEditor() {
  const [loading, setLoading] = useState(false);
  const [sqlCode, setSQLCode] = useState('');

  const [track, setTrack] = useState(false);
  const [cascade, setCascade] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  const { currentProject } = useCurrentWorkspaceAndProject();

  const onChange = useCallback((value: string) => setSQLCode(value), []);

  // TODO convert to form
  // TODO inlude a tooltip for info about the checkboxes
  // TODO add this and figure out how to show the input to write the migration name

  // const isPlatform = useIsPlatform();
  // const [isMigration, setIsMigration] = useState(false);

  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([[]]);

  const [error, setError] = useState('');

  const appUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'hasura',
  );

  const adminSecret =
    process.env.NEXT_PUBLIC_ENV === 'dev'
      ? getHasuraAdminSecret()
      : currentProject?.config?.hasura.adminSecret;

  const sendSQLToHasura = async () => {
    setLoading(true);
    setError('');

    const response: {
      result: string[][];
      result_type: string;
    } = await fetch(`${appUrl}/v2/query`, {
      method: 'POST',
      headers: {
        'x-hasura-admin-secret': adminSecret,
      },
      body: JSON.stringify({
        args: {
          source: 'default',
          sql: sqlCode,
        },
        type: 'run_sql',
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json();
          setError(e?.internal?.error?.message);
          return null;
        }
        return res.json();
      })
      .catch((err) => console.log({ error: err }))
      .finally(() => setLoading(false));

    if (response?.result_type === 'TuplesOk') {
      setColumns(response.result.at(0));
      setRows(response.result.slice(1));
    }
  };

  return (
    <Box className="flex flex-1 flex-col bg-white">
      <Box className="flex flex-col space-y-2 border-b p-4 md:flex-row md:items-center md:justify-between">
        <Text className="font-semibold">Raw SQL</Text>
        <Box className="flex flex-col md:flex-row md:space-x-2">
          <Switch
            label={
              <Text variant="subtitle1" component="span">
                Track this
              </Text>
            }
            checked={track}
            onChange={(event) => setTrack(event.currentTarget.checked)}
          />
          <Switch
            label={
              <Text variant="subtitle1" component="span">
                Cascade metadata
              </Text>
            }
            checked={cascade}
            onChange={(e) => setCascade(e.target.checked)}
          />
          <Switch
            label={
              <Text variant="subtitle1" component="span">
                Read only
              </Text>
            }
            checked={readOnly}
            onChange={(e) => setReadOnly(e.target.checked)}
          />
          <Box>
            <Button
              disabled={loading}
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={sendSQLToHasura}
            >
              Run
            </Button>
          </Box>
        </Box>
      </Box>

      <Box className="border-b">
        {/* TODO Change the theme on dark mode */}
        <CodeMirror
          value={sqlCode}
          height="20rem"
          extensions={[sql({ dialect: PostgreSQL })]}
          onChange={onChange}
        />
      </Box>
      <div className="flex flex-1 items-start overflow-auto bg-gray-50 p-4">
        {error && (
          <Alert
            severity="error"
            className="grid grid-flow-row place-content-center gap-2"
          >
            <Text color="warning" className="text-sm">
              <code>{error}</code>
            </Text>
          </Alert>
        )}
        {loading && (
          <ActivityIndicator circularProgressProps={{ className: 'w-5 h-5' }} />
        )}
        {!loading && !error && (
          <table className="table-auto text-left text-sm text-gray-500 rtl:text-right dark:text-gray-400">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                {columns.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="whitespace-nowrap border px-6 py-3"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  // eslint-disable-next-line react/no-array-index-key
                  key={String(rowIndex)}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  {/* eslint-disable-next-line react/no-array-index-key */}
                  {row.map((value, valueIndex) => (
                    <td
                      // eslint-disable-next-line react/no-array-index-key
                      key={`${value}-${valueIndex}`}
                      className="whitespace-nowrap border px-6 py-4"
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Box>
  );
}
