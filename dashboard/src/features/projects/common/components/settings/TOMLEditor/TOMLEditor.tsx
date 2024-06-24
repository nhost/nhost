import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  useGetConfigRawJsonQuery,
  useReplaceConfigRawJsonMutation,
  type ConfigConfigInsertInput,
} from '@/utils/__generated__/graphql';
import { StreamLanguage } from '@codemirror/language';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import * as TOML from '@iarna/toml';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useState } from 'react';

export default function TOMLEditor() {
  const theme = useTheme();
  const isPlatform = useIsPlatform();

  const [tomlCode, setTOMLCode] = useState('');

  const { openDialog } = useDialog();

  const { currentProject } = useCurrentWorkspaceAndProject();

  const localMimirClient = useLocalMimirClient();

  // fetch the initial TOML code from the server
  const { data, loading } = useGetConfigRawJsonQuery({
    variables: {
      appID: currentProject?.id,
    },
    skip: !currentProject,
  });

  const [saveConfigMutation] = useReplaceConfigRawJsonMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const removeTOMLIndentation = (tomlStr: string) => {
    const trimmedLines = tomlStr.split('\n').map((line) => line.trimStart());
    return trimmedLines.join('\n');
  };

  useEffect(() => {
    // Load TOML code from the server on initial load
    if (!loading && data) {
      const jsonData = JSON.parse(data?.configRawJSON);
      const tomlStr = TOML.stringify(jsonData);
      const unindentedTOMLConfig = removeTOMLIndentation(tomlStr);
      setTOMLCode(unindentedTOMLConfig);
    }
  }, [loading, data]);

  const onChange = useCallback((value: string) => setTOMLCode(value), []);

  const handleSave = async () => {
    const jsonEditedConfig = TOML.parse(tomlCode) as ConfigConfigInsertInput;
    const rawJSONString = JSON.stringify(jsonEditedConfig);

    await execPromiseWithErrorToast(
      async () => {
        const {
          data: { replaceConfigRawJSON: updatedConfig },
        } = await saveConfigMutation({
          variables: {
            appID: currentProject?.id,
            rawJSON: rawJSONString,
          },
        });

        if (updatedConfig) {
          const jsonUpdatedConfig = JSON.parse(updatedConfig);
          const updatedTOMLConfig = TOML.stringify(jsonUpdatedConfig);
          const unindentedTOMLConfig = removeTOMLIndentation(updatedTOMLConfig);
          setTOMLCode(unindentedTOMLConfig);
        }

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
      },
      {
        loadingMessage: 'Saving configuration...',
        successMessage: 'Configuration has been saved successfully.',
        errorMessage:
          'An error occurred while saving configuration. Please try again.',
      },
    );
  };

  return (
    <Box className="mb-0 flex max-h-[calc(100vh-80px)] flex-col justify-center overflow-hidden p-0">
      <Box className="flex flex-col space-y-2 border-b p-4">
        <Text className="font-semibold">Raw TOML Settings</Text>
      </Box>

      {loading ? (
        <Box
          className="h-full min-h-[500px] w-full animate-pulse"
          sx={{ backgroundColor: 'grey.200' }}
        />
      ) : (
        <CodeMirror
          value={tomlCode}
          height="100%"
          width="100%"
          className="min-h-[500px] flex-1 overflow-y-auto"
          theme={theme.palette.mode === 'light' ? githubLight : githubDark}
          extensions={[StreamLanguage.define(toml)]}
          onChange={onChange}
        />
      )}
      <Box className="grid w-full flex-shrink-0 snap-end grid-flow-col justify-between gap-3 place-self-end border-t-1 p-2">
        <Button variant="outlined" disabled={loading} color="secondary">
          Cancel
        </Button>

        <Button
          type="submit"
          disabled={loading}
          className="justify-self-end"
          onClick={handleSave}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
}
