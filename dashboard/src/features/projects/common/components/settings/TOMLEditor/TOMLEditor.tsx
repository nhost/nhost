import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import {
  useGetConfigRawJsonQuery,
  useReplaceConfigRawJsonMutation,
} from '@/utils/__generated__/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { StreamLanguage } from '@codemirror/language';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import * as TOML from '@iarna/toml';
import { useTheme } from '@mui/material';
import { bbedit } from '@uiw/codemirror-theme-bbedit';
import { githubDark } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function TOMLEditor() {
  const theme = useTheme();
  const isPlatform = useIsPlatform();

  const [tomlCode, setTOMLCode] = useState('');
  const [previousTOMLCode, setPreviousTOMLCode] = useState(''); // used to revert changes
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // used to show loading spinner on save

  const { openDialog } = useDialog();

  const { currentProject } = useCurrentWorkspaceAndProject();

  const localMimirClient = useLocalMimirClient();

  // fetch the initial TOML code from the server
  const { data, loading } = useGetConfigRawJsonQuery({
    variables: {
      appID: currentProject?.id,
    },
    skip: !currentProject,
    ...(!isPlatform ? { client: localMimirClient } : {}),
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
      setPreviousTOMLCode(unindentedTOMLConfig);
    }
  }, [loading, data]);

  const onChange = useCallback((value: string) => {
    setTOMLCode(value);
    setIsDirty(true);
  }, []);

  const handleRevert = () => {
    setTOMLCode(previousTOMLCode);
    setIsDirty(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    let jsonEditedConfig;
    try {
      jsonEditedConfig = TOML.parse(tomlCode);
    } catch (error) {
      const toastStyle = getToastStyleProps();
      const { line, col } = error;
      let message = `An error occurred while parsing the TOML file. Please check the syntax.`;
      if (line !== undefined && col !== undefined) {
        message = `An error occurred while parsing the TOML file. Please check the syntax at line ${line}, column ${col}.`;
      }
      toast.error(message, {
        style: toastStyle.style,
        ...toastStyle.error,
      });
      setIsSaving(false);
      return;
    }
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
          setPreviousTOMLCode(unindentedTOMLConfig);
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
        setIsDirty(false);
        setIsSaving(false);
      },
      {
        loadingMessage: 'Saving configuration...',
        successMessage: 'Configuration has been saved successfully.',
        errorMessage:
          'An error occurred while saving configuration. Please try again.',
        onError: () => {
          setIsSaving(false);
        },
      },
    );
  };

  return (
    <>
      <Box className="flex w-full flex-col space-y-2 border-b p-4">
        <Text className="font-semibold">Configuration Editor</Text>
      </Box>
      <Box className="h-full overflow-auto">
        {loading ? (
          <Box
            className="h-full w-full animate-pulse"
            sx={{ backgroundColor: 'grey.200' }}
          />
        ) : (
          <CodeMirror
            value={tomlCode}
            height="100%"
            width="100%"
            theme={theme.palette.mode === 'light' ? bbedit : githubDark}
            extensions={[StreamLanguage.define(toml)]}
            onChange={onChange}
          />
        )}
      </Box>
      <Box className="grid w-full grid-flow-col justify-end gap-3 place-self-end border-t-1 px-4 py-3 md:justify-between">
        <Button
          variant="outlined"
          disabled={loading || !isDirty}
          onClick={handleRevert}
          color="secondary"
        >
          Revert changes
        </Button>

        <Button
          type="submit"
          disabled={loading || !isDirty}
          loading={isSaving}
          className="justify-self-end"
          onClick={handleSave}
        >
          Save
        </Button>
      </Box>
    </>
  );
}
