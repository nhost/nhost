import { StreamLanguage } from '@codemirror/language';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import * as TOML from '@iarna/toml';
import { bbedit } from '@uiw/codemirror-theme-bbedit';
import { githubDark } from '@uiw/codemirror-theme-github';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { SettingsDocsLink } from '@/components/layout/SettingsCard';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetConfigRawJsonQuery,
  useReplaceConfigRawJsonMutation,
} from '@/generated/graphql';
import { codeMirrorAppBackground } from '@/lib/codeMirrorAppTheme';
import { useThemePreference } from '@/providers/Theme';
import { getToastStyleProps } from '@/utils/constants/settings';

const removeTOMLIndentation = (tomlStr: string) => {
  const trimmedLines = tomlStr.split('\n').map((line) => line.trimStart());
  return trimmedLines.join('\n');
};

export default function TOMLEditor() {
  const { resolvedTheme } = useThemePreference();
  const isPlatform = useIsPlatform();

  const [tomlCode, setTOMLCode] = useState('');
  const [previousTOMLCode, setPreviousTOMLCode] = useState(''); // used to revert changes
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // used to show loading spinner on save

  const { openDialog } = useDialog();

  // When the cursor moves up with the arrow keys, the editor scrolls to keep it
  // visible. The margin keeps it below the sticky header instead of behind it.
  const headerRef = useRef<HTMLDivElement>(null);
  const stickyHeaderMargin = useMemo(
    () =>
      EditorView.scrollMargins.of(() => ({
        top: headerRef.current?.offsetHeight ?? 0,
      })),
    [],
  );

  const { project } = useProject();

  const localMimirClient = useLocalMimirClient();

  // fetch the initial TOML code from the server
  const { data, loading } = useGetConfigRawJsonQuery({
    variables: {
      appID: project?.id,
    },
    skip: !project,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const [saveConfigMutation] = useReplaceConfigRawJsonMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

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
    let jsonEditedConfig: TOML.JsonMap | null = null;
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
        const response = await saveConfigMutation({
          variables: {
            appID: project?.id,
            rawJSON: rawJSONString,
          },
        });

        const updatedConfig = response?.data?.replaceConfigRawJSON;

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
    // Not a SettingsCard: that is for settings forms and clips its content,
    // which would stop the header from sticking. Same border, radius and
    // spacing, so it reads like the other settings cards.
    // min-w-0: a very long line scrolls inside the editor instead of
    // stretching the page and pushing Revert and Save off screen.
    <section className="min-w-0 rounded-lg border">
      <div
        ref={headerRef}
        className="sticky top-0 z-10 flex flex-col gap-3 rounded-t-lg border-b bg-background px-6 py-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="min-w-0 text-muted-foreground sm:max-w-lg">
          Edit your project&apos;s configuration directly in TOML. Use it for
          settings that don&apos;t have their own page yet.{' '}
          <span className="inline-flex align-middle">
            <SettingsDocsLink
              href="https://docs.nhost.io/reference/configuration"
              topic="the configuration file"
            />
          </span>
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={loading || !isDirty}
            onClick={handleRevert}
          >
            Revert changes
          </Button>
          <ButtonWithLoading
            type="submit"
            disabled={loading || !isDirty}
            loading={isSaving}
            onClick={handleSave}
          >
            Save
          </ButtonWithLoading>
        </div>
      </div>

      {/* Clips the corners without becoming a scroll container, so the
          search panel (Cmd+F) can stick to the bottom of the window. */}
      <div className="overflow-clip rounded-b-lg">
        {loading ? (
          <div className="h-96 w-full animate-pulse bg-muted" />
        ) : (
          <CodeMirror
            value={tomlCode}
            width="100%"
            minHeight="24rem"
            theme={resolvedTheme === 'light' ? bbedit : githubDark}
            extensions={[
              StreamLanguage.define(toml),
              codeMirrorAppBackground,
              stickyHeaderMargin,
            ]}
            onChange={onChange}
          />
        )}
      </div>
    </section>
  );
}
