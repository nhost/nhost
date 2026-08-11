import { useApolloClient } from '@apollo/client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { SelectItem } from '@/components/ui/v3/select';
import CreatedPATAlert from '@/features/account/settings/components/CreatePATForm/CreatedPATAlert';
import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import { GetPersonalAccessTokensDocument } from '@/generated/graphql';
import { useNhostClient } from '@/providers/nhost';
import { getDateComponents } from '@/utils/getDateComponents';

export const createPATFormValidationSchema = Yup.object({
  name: Yup.string().label('Name').required(),
  expiresAt: Yup.string().label('Expiration date').required(),
});

export type CreatePATFormValues = Yup.InferType<
  typeof createPATFormValidationSchema
>;

export interface CreatePATFormProps {
  onCancel?: VoidFunction;
}

function getStringifiedDateOffset(offsetDays: number) {
  const { year, month, day } = getDateComponents(
    new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000),
  );

  return `${year}-${month}-${day}`;
}

function getDaysUntilNextYearSameDay() {
  const now = new Date();
  const nextYear = now.getFullYear() + 1;
  const isNextYearLeapYear =
    nextYear % 4 === 0 && (nextYear % 100 !== 0 || nextYear % 400 === 0);

  if (!isNextYearLeapYear) {
    return 365;
  }

  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();

  if (currentMonth < 2 || (currentMonth === 2 && currentDay < 29)) {
    return 365;
  }

  return 366;
}

export default function CreatePATForm({ onCancel }: CreatePATFormProps) {
  const [personalAccessToken, setPersonalAccessToken] = useState<string | null>(
    null,
  );
  const nhostClient = useNhostClient();
  const apolloClient = useApolloClient();
  const form = useForm<CreatePATFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      name: '',
      expiresAt: '',
    },
    resolver: yupResolver(createPATFormValidationSchema),
  });

  const createPAT = useActionWithElevatedPermissions({
    actionFn: async (
      expiresAt: string,
      metadata?: Record<string, string | number>,
    ) => {
      const result = await nhostClient.auth.createPAT({ expiresAt, metadata });
      return result;
    },
    successMessage: 'The personal access token has been created successfully.',
    onSuccess: ({ body }) => {
      setPersonalAccessToken(body.personalAccessToken);
      apolloClient.refetchQueries({
        include: [GetPersonalAccessTokensDocument],
      });

      form.reset();
    },
  });

  async function handleSubmit(formValues: CreatePATFormValues) {
    const expiresAt = new Date(formValues.expiresAt).toISOString();
    await createPAT(expiresAt, {
      name: formValues.name,
      application: 'dashboard',
      userAgent: window.navigator.userAgent,
    });
  }

  if (personalAccessToken) {
    return (
      <div className="grid grid-flow-row gap-4">
        <CreatedPATAlert personalAccessToken={personalAccessToken} />

        <Button
          type="button"
          variant="outline"
          aria-label="Close personal access token dialog"
          onClick={onCancel}
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-flow-row gap-4">
      <p className="text-muted-foreground text-sm">
        Personal access tokens are used to authenticate with Nhost services.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="grid grid-flow-row gap-4"
        >
          <FormInput
            control={form.control}
            name="name"
            label="Name"
            autoFocus
            helperText={
              form.formState.errors.name ? undefined : 'Enter a unique name'
            }
          />

          <FormSelect
            control={form.control}
            name="expiresAt"
            placeholder="Select date"
            label="Expiration"
            contentClassName="z-[10000]"
          >
            <SelectItem value={getStringifiedDateOffset(7)}>7 days</SelectItem>
            <SelectItem value={getStringifiedDateOffset(14)}>
              14 days
            </SelectItem>
            <SelectItem value={getStringifiedDateOffset(30)}>
              30 days
            </SelectItem>
            <SelectItem value={getStringifiedDateOffset(60)}>
              60 days
            </SelectItem>
            <SelectItem value={getStringifiedDateOffset(90)}>
              90 days
            </SelectItem>
            <SelectItem value={getStringifiedDateOffset(180)}>
              180 days
            </SelectItem>
            <SelectItem
              value={getStringifiedDateOffset(getDaysUntilNextYearSameDay())}
            >
              1 year
            </SelectItem>
          </FormSelect>

          <div className="grid grid-flow-row gap-2">
            <ButtonWithLoading
              type="submit"
              loading={form.formState.isSubmitting}
            >
              Create
            </ButtonWithLoading>

            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
