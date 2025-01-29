import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import type { DialogFormProps } from '@/types/common';
import {
  GetAllWorkspacesAndProjectsDocument,
  useInsertWorkspaceMutation,
  useUpdateWorkspaceMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { slugifyString } from '@/utils/helpers';
import { yupResolver } from '@hookform/resolvers/yup';
import { useUserData } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export interface EditWorkspaceNameFormProps extends DialogFormProps {
  /**
   * The current workspace name if this is an edit operation.
   */
  currentWorkspaceName?: string;
  /**
   * The current workspace name id if this is an edit operation.
   */
  currentWorkspaceId?: string;
  /**
   * Determines whether the form is disabled.
   */
  disabled?: boolean;
  /**
   * Submit button text.
   *
   * @default 'Create'
   */
  submitButtonText?: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => void;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

const validationSchema = Yup.object({
  newWorkspaceName: Yup.string()
    .required('Workspace name is required.')
    .min(4, 'The new Workspace name must be at least 4 characters.')
    .max(32, "The new Workspace name can't be longer than 32 characters.")
    .test(
      'canBeSlugified',
      `This field should be at least 4 characters and can't be longer than 32 characters.`,
      (value) => {
        const slug = slugifyString(value);

        if (slug.length < 4 || slug.length > 32) {
          return false;
        }

        return true;
      },
    ),
});

export type EditWorkspaceNameFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function EditWorkspaceNameForm({
  disabled,
  onSubmit,
  onCancel,
  currentWorkspaceName,
  currentWorkspaceId,
  submitButtonText = 'Create',
  location,
}: EditWorkspaceNameFormProps) {
  const { onDirtyStateChange } = useDialog();
  const currentUser = useUserData();
  const [insertWorkspace, { client }] = useInsertWorkspaceMutation();
  const [updateWorkspaceName] = useUpdateWorkspaceMutation({
    refetchQueries: [GetAllWorkspacesAndProjectsDocument],
    awaitRefetchQueries: true,
    ignoreResults: true,
  });
  const router = useRouter();

  const form = useForm<EditWorkspaceNameFormValues>({
    defaultValues: {
      newWorkspaceName: currentWorkspaceName || '',
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { dirtyFields, isSubmitting, errors },
  } = form;
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  async function handleSubmit({
    newWorkspaceName,
  }: EditWorkspaceNameFormValues) {
    const slug = slugifyString(newWorkspaceName);

    try {
      if (currentWorkspaceId) {
        onDirtyStateChange(false, location);

        // In this bit of code we spread the props of the current path (e.g. /workspace/...) and add one key-value pair: `mutating: true`.
        // We want to indicate that the currently we're in the process of running a mutation state that will affect the routing behaviour of the website
        // i.e. redirecting to 404 if there's no workspace/project with that slug.
        await router.replace({
          pathname: router.pathname,
          query: { ...router.query, updating: true },
        });

        await execPromiseWithErrorToast(
          async () => {
            await updateWorkspaceName({
              variables: {
                id: currentWorkspaceId,
                workspace: {
                  name: newWorkspaceName,
                  slug,
                },
              },
            });
          },
          {
            loadingMessage: 'Updating workspace name...',
            successMessage: 'Workspace name has been updated successfully.',
            errorMessage:
              'An error occurred while updating the workspace name.',
          },
        );
      } else {
        await execPromiseWithErrorToast(
          async () => {
            await insertWorkspace({
              variables: {
                workspace: {
                  name: newWorkspaceName,
                  companyName: newWorkspaceName,
                  email: currentUser.email,
                  slug,
                  workspaceMembers: {
                    data: [
                      {
                        userId: currentUser.id,
                        type: 'owner',
                      },
                    ],
                  },
                },
              },
            });
          },
          {
            loadingMessage: 'Creating new workspace...',
            successMessage: 'The new workspace has been created successfully.',
            errorMessage: 'An error occurred while creating the new workspace.',
          },
        );
      }
    } catch (error) {
      if (error.message?.includes('duplicate key value')) {
        form.setError(
          'newWorkspaceName',
          {
            type: 'manual',
            message: 'This workspace name is already taken.',
          },
          {
            shouldFocus: false,
          },
        );
      }

      return;
    }

    await client.refetchQueries({
      include: [GetAllWorkspacesAndProjectsDocument],
    });

    // The form has been submitted, it's not dirty anymore
    onDirtyStateChange(false, location);

    await router.push(slug);
    onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden pb-6 pt-2"
      >
        <div className="flex-auto overflow-y-auto px-6">
          <Input
            {...register('newWorkspaceName')}
            error={Boolean(errors.newWorkspaceName?.message)}
            label="Name"
            helperText={errors.newWorkspaceName?.message}
            autoFocus={!disabled}
            disabled={disabled}
            fullWidth
            hideEmptyHelperText
            placeholder='e.g. "My Workspace"'
          />
        </div>

        <div className="grid flex-shrink-0 grid-flow-row gap-2 px-6 pt-4">
          {!disabled && (
            <Button
              loading={isSubmitting}
              disabled={
                isSubmitting || Boolean(errors.newWorkspaceName?.message)
              }
              type="submit"
            >
              {currentWorkspaceName ? 'Save' : submitButtonText}
            </Button>
          )}

          <Button
            variant="outlined"
            color="secondary"
            onClick={onCancel}
            tabIndex={isDirty ? -1 : 0}
            autoFocus={disabled}
          >
            {disabled ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
