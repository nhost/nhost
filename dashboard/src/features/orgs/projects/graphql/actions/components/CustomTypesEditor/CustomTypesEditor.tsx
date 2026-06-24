import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { GraphQLSdlEditor } from '@/features/orgs/projects/graphql/actions/components/GraphQLSdlEditor';
import { useGetActions } from '@/features/orgs/projects/graphql/actions/hooks/useGetActions';
import { useSetCustomTypesMutation } from '@/features/orgs/projects/graphql/actions/hooks/useSetCustomTypesMutation';
import { composeTypesSdl } from '@/features/orgs/projects/graphql/actions/utils/composeTypesSdl';
import {
  hydrateTypeRelationships,
  parseCustomTypes,
  reformCustomTypes,
} from '@/features/orgs/projects/graphql/actions/utils/customTypesUtils';
import { parseTypesSdl } from '@/features/orgs/projects/graphql/actions/utils/parseTypesSdl';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export default function CustomTypesEditor() {
  const { data, isLoading, error } = useGetActions();
  const customTypes = data?.customTypes ?? {};

  const { mutateAsync: setCustomTypes, isPending } =
    useSetCustomTypesMutation();

  const [sdl, setSdl] = useState('');
  const [previousSdl, setPreviousSdl] = useState('');
  const isDirty = sdl !== previousSdl;

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

  if (error instanceof Error) {
    throw error;
  }

  const handleRevert = () => {
    setSdl(previousSdl);
  };

  const handleSave = async () => {
    const { types, error } = parseTypesSdl(sdl);

    if (error) {
      toast.error(error);
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
      },
      {
        loadingMessage: 'Saving custom types...',
        successMessage: 'Custom types have been saved successfully.',
        errorMessage:
          'An error occurred while saving the custom types. Please try again.',
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
          <GraphQLSdlEditor
            value={sdl}
            onChange={setSdl}
            aria-label="Custom types SDL editor"
            className="rounded-none border-0"
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
          loading={isPending}
          disabled={isLoading || !isDirty}
          onClick={handleSave}
        >
          Save
        </ButtonWithLoading>
      </div>
    </div>
  );
}
