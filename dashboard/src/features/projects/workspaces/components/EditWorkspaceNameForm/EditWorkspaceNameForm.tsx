import { CheckoutFormDialog } from '@/components/checkout';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import type { DialogFormProps } from '@/types/common';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { slugifyString } from '@/utils/helpers';
import { useCreateOrganizationRequestMutation } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PK
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK)
  : null;

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
  orgName: Yup.string()
    .required('Org name is required.')
    .min(4, 'Org name must be at least 4 characters.')
    .max(32, "Org name can't be longer than 32 characters.")
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

function EditWorkspaceNameFormComp({
  disabled,
  onCancel,
}: EditWorkspaceNameFormProps) {
  const { openDialog } = useDialog();
  const [createOrganizationRequest] = useCreateOrganizationRequestMutation();

  const form = useForm<EditWorkspaceNameFormValues>({
    defaultValues: {
      orgName: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { dirtyFields, isSubmitting, errors },
  } = form;
  const isDirty = Object.keys(dirtyFields).length > 0;

  async function handleSubmit({ orgName }: EditWorkspaceNameFormValues) {
    await execPromiseWithErrorToast(
      async () => {
        const { data } = await createOrganizationRequest({
          variables: {
            organizationName: orgName,
            planID: 'dc5e805e-1bef-4d43-809e-9fdf865e211a',
            redirectURL: 'http://localhost:3000/post-checkout',
          },
        });

        openDialog({
          title: '',
          component: (
            <CheckoutFormDialog
              clientSecret={data.billingCreateOrganizationRequest}
            />
          ),
        });
      },
      {
        loadingMessage: 'Creating new workspace...',
        successMessage: 'The new workspace has been created successfully.',
        errorMessage: 'An error occurred while creating the new workspace.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden pb-6 pt-2"
      >
        <div className="flex-auto overflow-y-auto px-6">
          <Input
            {...register('orgName')}
            error={Boolean(errors.orgName?.message)}
            label="Name"
            helperText={errors.orgName?.message}
            autoFocus={!disabled}
            disabled={disabled}
            fullWidth
            hideEmptyHelperText
            placeholder='e.g. "My org"'
          />
        </div>

        <div className="grid flex-shrink-0 grid-flow-row gap-2 px-6 pt-4">
          {!disabled && (
            <Button
              loading={isSubmitting}
              disabled={isSubmitting || Boolean(errors.orgName?.message)}
              type="submit"
            >
              Create
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

export default function EditWorkspaceNameForm() {
  return (
    <Elements stripe={stripePromise}>
      <EditWorkspaceNameFormComp />
    </Elements>
  );
}
