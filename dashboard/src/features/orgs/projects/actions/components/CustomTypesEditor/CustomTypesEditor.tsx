import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { graphql } from 'cm6-graphql';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useColorPreference } from '@/components/ui/v2/useColorPreference';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';
import { useSetCustomTypesMutation } from '@/features/orgs/projects/actions/hooks/useSetCustomTypesMutation';
import { composeTypesSdl } from '@/features/orgs/projects/actions/utils/composeTypesSdl';
import {
  hydrateTypeRelationships,
  parseCustomTypes,
  reformCustomTypes,
} from '@/features/orgs/projects/actions/utils/customTypesUtils';
import { parseTypesSdl } from '@/features/orgs/projects/actions/utils/parseTypesSdl';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getToastStyleProps } from '@/utils/constants/settings';

export default function CustomTypesEditor() {
  const { color } = useColorPreference();

  const { data, isLoading } = useGetActions();
  const customTypes = data?.customTypes ?? {};

  const { mutateAsync: setCustomTypes } = useSetCustomTypesMutation();

  const [sdl, setSdl] = useState('');
  const [previousSdl, setPreviousSdl] = useState(''); // used to revert changes
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // used to show loading spinner on save

  // Populate the editor from the metadata only on the first successful load.
  // Subsequent refetches (e.g. after a save) must not clobber in-progress edits.
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || isLoading || !data) {
      return;
    }

    const initialSdl = composeTypesSdl(parseCustomTypes(data.customTypes));
    setSdl(initialSdl);
    setPreviousSdl(initialSdl);
    initializedRef.current = true;
  }, [isLoading, data]);

  const onChange = useCallback((value: string) => {
    setSdl(value);
    setIsDirty(true);
  }, []);

  const handleRevert = () => {
    setSdl(previousSdl);
    setIsDirty(false);
  };

  const handleSave = async () => {
    setIsSaving(true);

    const { types, error } = parseTypesSdl(sdl);

    if (error) {
      const toastStyle = getToastStyleProps();
      toast.error(error, {
        style: toastStyle.style,
        ...toastStyle.error,
      });
      setIsSaving(false);
      return;
    }

    // Relationships can't be expressed in SDL, so re-attach the existing ones
    // by type name before persisting to avoid wiping them.
    const hydratedTypes = hydrateTypeRelationships(
      types,
      parseCustomTypes(customTypes),
    );

    await execPromiseWithErrorToast(
      async () => {
        await setCustomTypes({
          customTypes: reformCustomTypes(hydratedTypes),
          previousCustomTypes: customTypes,
        });

        setPreviousSdl(sdl);
        setIsDirty(false);
        setIsSaving(false);
      },
      {
        loadingMessage: 'Saving custom types...',
        successMessage: 'Custom types have been saved successfully.',
        errorMessage:
          'An error occurred while saving the custom types. Please try again.',
        onError: () => {
          setIsSaving(false);
        },
      },
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="flex w-full flex-col space-y-2 border-b-1 p-4">
        <h1 className="font-semibold text-foreground">Custom Types Editor</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="h-full w-full animate-pulse bg-muted" />
        ) : (
          <CodeMirror
            value={sdl}
            height="100%"
            width="100%"
            aria-label="Custom types SDL editor"
            theme={color === 'light' ? githubLight : githubDark}
            extensions={[graphql()]}
            onChange={onChange}
          />
        )}
      </div>

      <div className="flex w-full items-center justify-end gap-4 px-4 py-3">
        <Button
          variant="outline"
          disabled={isLoading || !isDirty}
          onClick={handleRevert}
        >
          Revert changes
        </Button>

        <ButtonWithLoading
          loading={isSaving}
          disabled={isLoading || !isDirty}
          onClick={handleSave}
        >
          Save
        </ButtonWithLoading>
      </div>
    </div>
  );
}
