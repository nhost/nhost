import { type ReactNode, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';
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
import type { CustomTypes } from '@/utils/hasura-api/generated/schemas';

interface CustomTypesEditorShellProps {
  children: ReactNode;
  isDirty?: boolean;
  isSaving?: boolean;
  onRevert?: () => void;
  onSave?: () => void;
}

function CustomTypesEditorShell({
  children,
  isDirty = false,
  isSaving = false,
  onRevert,
  onSave,
}: CustomTypesEditorShellProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="flex w-full flex-col space-y-2 border-b-1 p-4">
        <h1 className="font-semibold text-foreground">Custom Types Editor</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">{children}</div>

      <div className="flex w-full items-center justify-end gap-4 px-4 py-3">
        <Button variant="outline" disabled={!isDirty} onClick={onRevert}>
          Revert changes
        </Button>

        <ButtonWithLoading
          loading={isSaving}
          disabled={!isDirty}
          onClick={onSave}
        >
          Save
        </ButtonWithLoading>
      </div>
    </div>
  );
}

interface CustomTypesEditorContentProps {
  customTypes: CustomTypes;
}

function CustomTypesEditorContent({
  customTypes,
}: CustomTypesEditorContentProps) {
  const { mutateAsync: setCustomTypes, isPending } =
    useSetCustomTypesMutation();

  const [sdl, setSdl] = useState(() =>
    composeTypesSdl(parseCustomTypes(customTypes)),
  );
  const [previousSdl, setPreviousSdl] = useState(sdl);
  const isDirty = sdl !== previousSdl;

  const handleRevert = () => {
    setSdl(previousSdl);
  };

  const handleSave = async () => {
    const { types, error: parseError } = parseTypesSdl(sdl);

    if (parseError) {
      toast.error(parseError);
      return;
    }

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
    <CustomTypesEditorShell
      isDirty={isDirty}
      isSaving={isPending}
      onRevert={handleRevert}
      onSave={handleSave}
    >
      <GraphQLSdlEditor
        value={sdl}
        onChange={setSdl}
        aria-label="Custom types SDL editor"
        className="rounded-none border-0"
      />
    </CustomTypesEditorShell>
  );
}

export default function CustomTypesEditor() {
  const { data, isLoading, error } = useGetActions();

  if (error instanceof Error) {
    throw error;
  }

  if (isLoading || !data) {
    return (
      <CustomTypesEditorShell>
        <Skeleton className="h-full w-full rounded-none" />
      </CustomTypesEditorShell>
    );
  }

  return <CustomTypesEditorContent customTypes={data.customTypes} />;
}
