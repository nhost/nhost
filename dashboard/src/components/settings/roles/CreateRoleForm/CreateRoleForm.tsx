import type {
  BaseRoleFormProps,
  BaseRoleFormValues,
} from '@/components/settings/roles/BaseRoleForm';
import BaseRoleForm, {
  baseRoleFormValidationSchema,
} from '@/components/settings/roles/BaseRoleForm';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  refetchGetRemoteAppRolesQuery,
  useInsertRemoteAppRoleMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface CreateRoleFormProps
  extends Pick<BaseRoleFormProps, 'onCancel'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function CreateRoleForm({
  onSubmit,
  ...props
}: CreateRoleFormProps) {
  const form = useForm<BaseRoleFormValues>({
    defaultValues: {},
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRoleFormValidationSchema),
  });

  const client = useRemoteApplicationGQLClient();
  const [insertRole] = useInsertRemoteAppRoleMutation({
    client,
    refetchQueries: [refetchGetRemoteAppRolesQuery()],
  });

  async function handleSubmit({ name }: BaseRoleFormValues) {
    const insertRolePromise = insertRole({
      variables: {
        object: {
          role: name,
        },
      },
    });

    await toast.promise(
      insertRolePromise,
      {
        loading: 'Creating role...',
        success: 'Role has been created successfully.',
        error: 'An error occurred while trying to create the role.',
      },
      getToastStyleProps(),
    );
    await onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <BaseRoleForm submitButtonText="Add" onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}
