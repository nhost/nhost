import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/LogicalModelForms';
import NativeQueryForm, {
  type NativeQueryFormValues,
} from '@/features/orgs/projects/database/native-queries/components/NativeQueryForm';
import useGetLogicalModels from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import useGetNativeQueries from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import useNativeQueryMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import buildNativeQueryTrackArgs from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';
import { nativeQueryToFormValues } from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

interface DrawerFormProps {
  onCancel?: (event?: unknown) => void;
}

type CreateStep = 'native-query' | 'logical-model';

function useLogicalModelStep(fetchedModelNames: string[]) {
  const [step, setStep] = useState<CreateStep>('native-query');
  const [localModelNames, setLocalModelNames] = useState<string[]>([]);
  const [returnModelSelection, setReturnModelSelection] = useState<{
    name: string;
    revision: number;
  }>();
  const returnsTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreReturnsFocusRef = useRef(false);

  const logicalModelNames = [
    ...new Set([...fetchedModelNames, ...localModelNames]),
  ].sort((left, right) => left.localeCompare(right));

  useEffect(() => {
    if (step !== 'native-query' || !restoreReturnsFocusRef.current) {
      return;
    }

    restoreReturnsFocusRef.current = false;
    returnsTriggerRef.current?.focus();
  }, [step]);

  const openLogicalModel = useCallback(() => {
    setStep('logical-model');
  }, []);

  const returnToNativeQuery = useCallback(() => {
    restoreReturnsFocusRef.current = true;
    setStep('native-query');
  }, []);

  const registerCreatedModel = useCallback(
    (name: string) => {
      setLocalModelNames((current) =>
        current.includes(name) ? current : [...current, name],
      );
      setReturnModelSelection((current) => ({
        name,
        revision: (current?.revision ?? 0) + 1,
      }));
      returnToNativeQuery();
    },
    [returnToNativeQuery],
  );

  return {
    step,
    logicalModelNames,
    returnModelSelection,
    returnsTriggerRef,
    openLogicalModel,
    returnToNativeQuery,
    registerCreatedModel,
  };
}

export function CreateNativeQueryForm({ onCancel }: DrawerFormProps) {
  const modelsResult = useGetLogicalModels();
  const queriesResult = useGetNativeQueries();
  const mutation = useNativeQueryMetadataMutation({ type: 'add' });
  const initialValuesRef = useRef<NativeQueryFormValues | null>(null);

  const models = modelsResult.data ?? [];
  const queries = queriesResult.data ?? [];
  const {
    step,
    logicalModelNames,
    returnModelSelection,
    returnsTriggerRef,
    openLogicalModel,
    returnToNativeQuery,
    registerCreatedModel,
  } = useLogicalModelStep(models.map((model) => model.name));

  if (
    initialValuesRef.current === null &&
    (modelsResult.isLoading || queriesResult.isLoading)
  ) {
    return (
      <div
        className="space-y-4 p-6"
        role="status"
        aria-label="Loading creation form"
      >
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (
    initialValuesRef.current === null &&
    (modelsResult.error instanceof Error ||
      queriesResult.error instanceof Error)
  ) {
    return (
      <div className="space-y-4 p-6 text-foreground" role="alert">
        <p>Logical models and native queries could not be loaded.</p>
        <Button type="button" variant="outline" onClick={() => onCancel?.()}>
          Close
        </Button>
      </div>
    );
  }

  if (initialValuesRef.current === null) {
    initialValuesRef.current = {
      rootFieldName: '',
      returns: models[0]?.name ?? '',
      code: '',
      arguments: [],
    };
  }

  return (
    <div className="p-6 text-foreground">
      <h2 className="mb-2 font-semibold text-lg">
        {step === 'native-query' ? 'Native query' : 'Logical model'}
      </h2>
      <div hidden={step !== 'native-query'}>
        <p className="mb-5 text-muted-foreground text-sm">
          Expose a SQL query as a read-only GraphQL root field.
        </p>
        <NativeQueryForm
          resetToken="create"
          values={initialValuesRef.current}
          existingNames={queries.map((query) => query.root_field_name)}
          logicalModelNames={logicalModelNames}
          returnModelSelection={returnModelSelection}
          isPending={mutation.isPending}
          onCancel={() => onCancel?.()}
          onCreateLogicalModel={openLogicalModel}
          returnsTriggerRef={returnsTriggerRef}
          onSubmit={async (nextValues) => {
            const result = await execPromiseWithErrorToast(
              () =>
                mutation.mutateAsync({
                  args: buildNativeQueryTrackArgs(nextValues),
                }),
              {
                loadingMessage: 'Creating native query...',
                successMessage: 'Native query created.',
                errorMessage: 'Could not create the native query.',
              },
            );
            if (result) {
              onCancel?.();
            }
          }}
        />
      </div>
      {step === 'logical-model' && (
        <CreateLogicalModelForm
          logicalModelNames={logicalModelNames}
          onCancel={returnToNativeQuery}
          onCreated={registerCreatedModel}
        />
      )}
    </div>
  );
}

interface EditNativeQueryFormProps extends DrawerFormProps {
  query: NativeQueryItem;
}

export function EditNativeQueryForm({
  query,
  onCancel,
}: EditNativeQueryFormProps) {
  const { data: models = [] } = useGetLogicalModels();
  const { data: queries = [] } = useGetNativeQueries();
  const mutation = useNativeQueryMetadataMutation({ type: 'edit' });
  const values = useMemo(() => nativeQueryToFormValues(query), [query]);
  const {
    step,
    logicalModelNames,
    returnModelSelection,
    returnsTriggerRef,
    openLogicalModel,
    returnToNativeQuery,
    registerCreatedModel,
  } = useLogicalModelStep(models.map((model) => model.name));

  return (
    <div className="p-6 text-foreground">
      {step === 'logical-model' && (
        <h2 className="mb-2 font-semibold text-lg">Logical model</h2>
      )}
      <div hidden={step !== 'native-query'}>
        <p className="mb-5 text-muted-foreground text-sm">
          Update the root field, SQL, return model, or arguments.
        </p>
        <NativeQueryForm
          resetToken={query.root_field_name}
          values={values}
          existingNames={queries.map((item) => item.root_field_name)}
          originalName={query.root_field_name}
          logicalModelNames={logicalModelNames}
          returnModelSelection={returnModelSelection}
          isPending={mutation.isPending}
          onCancel={() => onCancel?.()}
          onCreateLogicalModel={openLogicalModel}
          returnsTriggerRef={returnsTriggerRef}
          onSubmit={async (nextValues) => {
            const result = await execPromiseWithErrorToast(
              () =>
                mutation.mutateAsync({
                  original: query,
                  args: buildNativeQueryTrackArgs(nextValues, query),
                }),
              {
                loadingMessage: 'Updating native query...',
                successMessage: 'Native query updated.',
                errorMessage: 'Could not update the native query.',
              },
            );
            if (result) {
              onCancel?.();
            }
          }}
        />
      </div>
      {step === 'logical-model' && (
        <CreateLogicalModelForm
          logicalModelNames={logicalModelNames}
          onCancel={returnToNativeQuery}
          onCreated={registerCreatedModel}
        />
      )}
    </div>
  );
}
