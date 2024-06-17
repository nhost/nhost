import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { StreamLanguage } from '@codemirror/language';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useState } from 'react';
import { type ConfigConfigInsertInput, useGetConfigRawJsonQuery, useReplaceConfigMutation, GetConfigRawJsonDocument } from '@/utils/__generated__/graphql';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import * as TOML from '@iarna/toml'
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useDialog } from '@/components/common/DialogProvider';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';

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

  const [saveConfigMutation] = useReplaceConfigMutation(
    {
      refetchQueries: [GetConfigRawJsonDocument],
      ...(!isPlatform ? { client: localMimirClient } : {}),
    }
  )

  useEffect(() => {
    // Load TOML code from the server on initial load
    if (!loading && data) {
      const jsonData = JSON.parse(data?.configRawJSON)
      const tomlStr = TOML.stringify(jsonData)
      setTOMLCode(tomlStr)
    }
  }, [loading, data])

  const onChange = useCallback((value: string) => setTOMLCode(value), []);

  const handleSave = async () => {
    const jsonEditedConfig = TOML.parse(tomlCode) as ConfigConfigInsertInput

    await execPromiseWithErrorToast(
      async () => {
        await saveConfigMutation({
          variables: {
            appID: currentProject?.id,
            config: jsonEditedConfig,
          },
        })

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
        loadingMessage: 'Saving the configuration...',
        successMessage: 'The configuration has been saved successfully.',
        errorMessage:
          'An error occurred while saving the configuration. Please try again.',
      },
    );
  }

  return (
    <Box className="flex flex-1 max-h-[calc(100vh-80px)] flex-col justify-center p-0 overflow-hidden">
      <Box className="flex flex-col space-y-2 border-b p-4">
        <Text className="font-semibold">Raw TOML Settings</Text>
      </Box>

      <CodeMirror
        value={tomlCode}
        height="100%"
        width="100%"
        className="min-h-[100px] flex-1 overflow-y-auto"
        theme={theme.palette.mode === 'light' ? githubLight : githubDark}
        extensions={[StreamLanguage.define(toml)]}
        onChange={onChange}
      />
      <Box className="grid w-full flex-shrink-0 snap-end grid-flow-col justify-between gap-3 place-self-end border-t-1 p-2">
        <Button
          variant="outlined"
          color="secondary"
        >
          Cancel
        </Button>

        <Button
          type="submit"
          className="justify-self-end"
          onClick={handleSave}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
}
