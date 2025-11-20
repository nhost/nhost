import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v3/button';
import type { BaseTableFormProps } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { useTrackForeignKeyRelationsMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation';
import { useUpdateTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateTableMutation';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeDatabaseColumn } from '@/features/orgs/projects/database/dataGrid/utils/normalizeDatabaseColumn';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTableIsEnumQuery } from '../../hooks/useTableIsEnumQuery';
import {
  defaultFormValues,
  EditSettingsFormValues,
  validationSchema,
} from './EditSettingsFormTypes';
import ColumnsCustomizationForm from './sections/ColumnsCustomizationForm';
import CustomGraphQLRootFieldsForm from './sections/CustomGraphQLRootFieldsForm';
import SetIsEnumForm from './sections/SetIsEnumForm';

export interface EditSettingsFormProps
  extends Pick<BaseTableFormProps, 'onCancel' | 'location'> {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table to be edited.
   */
  table: NormalizedQueryDataRow;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (tableName: string) => Promise<void>;
}

export default function EditSettingsForm({
  onSubmit,
  schema,
  table: originalTable,
  ...props
}: EditSettingsFormProps) {
  const [formInitialized, setFormInitialized] = useState(false);
  const router = useRouter();

  const {
    data,
    status: columnsStatus,
    error: columnsError,
  } = useTableQuery([`default.${schema}.${originalTable.table_name}`], {
    schema,
    table: originalTable.table_name,
  });

  console.log('data', data);

  const { data: isEnum } = useTableIsEnumQuery({
    table: {
      name: originalTable.table_name,
      schema,
    },
    dataSource: 'default',
  });
  console.log('isEnum', isEnum);

  const columns = data?.columns;
  const foreignKeyRelations = data?.foreignKeyRelations;

  const dataGridColumns = (columns || []).map((column) =>
    normalizeDatabaseColumn(column),
  );

  const {
    mutateAsync: trackForeignKeyRelations,
    error: foreignKeyError,
    reset: resetForeignKeyError,
  } = useTrackForeignKeyRelationsMutation();

  const {
    mutateAsync: updateTable,
    error: updateError,
    reset: resetUpdateError,
  } = useUpdateTableMutation({ schema });

  const error = columnsError || updateError || foreignKeyError;

  function resetError() {
    resetForeignKeyError();
    resetUpdateError();
  }

  const form = useForm<EditSettingsFormValues>({
    defaultValues: defaultFormValues,
    reValidateMode: 'onSubmit',
    resolver: zodResolver(validationSchema),
  });

  const { isDirty, isSubmitting } = form.formState;

  const handleCancel = () => {};

  if (columnsStatus === 'loading') {
    return (
      <div className="px-6">
        <ActivityIndicator label="Loading columns..." delay={1000} />
      </div>
    );
  }

  // if (!formInitialized) {
  //   return (
  //     <div className="px-6">
  //       <ActivityIndicator label="Loading..." delay={1000} />
  //     </div>
  //   );
  // }

  if (columnsStatus === 'error') {
    return (
      <div className="-mt-3 px-6">
        <Alert severity="error" className="text-left">
          <strong>Error:</strong>{' '}
          {columnsError && columnsError instanceof Error
            ? columnsError?.message
            : 'An error occurred while loading the columns. Please try again.'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        <ColumnsCustomizationForm
          schema={schema}
          tableName={originalTable.table_name}
        />
        <CustomGraphQLRootFieldsForm
          schema={schema}
          tableName={originalTable.table_name}
        />
        <SetIsEnumForm schema={schema} tableName={originalTable.table_name} />
      </div>

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 px-6 py-3">
        <Button
          variant="outline"
          color="secondary"
          onClick={handleCancel}
          tabIndex={isDirty ? -1 : 0}
        >
          Back
        </Button>

        {/* <ButtonWithLoading
          loading={isSubmitting}
          disabled={isSubmitting}
          type="submit"
          className="justify-self-end"
        >
          Save
        </ButtonWithLoading> */}
      </div>
    </div>
  );
}
