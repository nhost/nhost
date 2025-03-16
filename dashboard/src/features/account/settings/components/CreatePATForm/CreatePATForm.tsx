import { useDialog } from '@/components/common/DialogProvider';
import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Form } from '@/components/form/Form';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import type { DialogFormProps } from '@/types/common';
import { GetPersonalAccessTokensDocument } from '@/utils/__generated__/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { copy } from '@/utils/copy';
import { getDateComponents } from '@/utils/getDateComponents';
import { useApolloClient } from '@apollo/client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNhostClient } from '@nhost/nextjs';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export const createPATFormValidationSchema = Yup.object({
  name: Yup.string().label('Name').nullable().required(),
  expiresAt: Yup.string().label('Expiration date').nullable().required(),
});

export type CreatePATFormValues = Yup.InferType<
  typeof createPATFormValidationSchema
>;

export interface CreatePATFormProps extends DialogFormProps {
  /**
   * Function to be called when the operation is cancelled.
   */
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

export default function CreatePATForm({
  onCancel,
  location,
}: CreatePATFormProps) {
  const [personalAccessToken, setPersonalAccessToken] = useState<string>();
  const { onDirtyStateChange } = useDialog();
  const nhostClient = useNhostClient();
  const apolloClient = useApolloClient();
  const form = useForm<CreatePATFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      name: null,
      expiresAt: null,
    },
    resolver: yupResolver(createPATFormValidationSchema),
  });

  const { register, formState } = form;

  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  async function handleSubmit(formValues: CreatePATFormValues) {
    try {
      const { error, data } = await nhostClient.auth.createPAT(
        new Date(formValues.expiresAt),
        {
          name: formValues.name,
          application: 'dashboard',
          userAgent: window.navigator.userAgent,
        },
      );

      const toastStyle = getToastStyleProps();

      if (error) {
        toast.error(error.message, {
          style: toastStyle.style,
          ...toastStyle.error,
        });
        return;
      }

      toast.success(
        'The personal access token has been created successfully.',
        {
          style: toastStyle.style,
          ...toastStyle.success,
        },
      );

      setPersonalAccessToken(data?.personalAccessToken);

      apolloClient.refetchQueries({
        include: [GetPersonalAccessTokensDocument],
      });

      form.reset();
    } catch {
      // Note: This error is handled by the toast.
    }
  }

  if (personalAccessToken) {
    return (
      <Box className="grid grid-flow-row gap-4 px-6 pb-6">
        <Alert severity="info" className="grid grid-flow-row gap-2">
          <Box className="grid grid-flow-row bg-transparent">
            <Text color="secondary" className="text-sm">
              This token will not be shown again. Make sure to copy it now.
            </Text>
          </Box>

          <Box className="grid grid-flow-col items-center justify-center gap-2 bg-transparent">
            <HighlightedText className="text-xs font-semibold">
              {personalAccessToken}
            </HighlightedText>

            <IconButton
              aria-label="Copy Personal Access Token"
              variant="borderless"
              color="secondary"
              onClick={() => copy(personalAccessToken, 'Personal access token')}
            >
              <CopyIcon className="h-4 w-4" />
            </IconButton>
          </Box>
        </Alert>

        <Button
          variant="outlined"
          color="secondary"
          onClick={() => {
            onDirtyStateChange(false, location);
            onCancel();
          }}
        >
          Close
        </Button>
      </Box>
    );
  }

  return (
    <Box className="grid grid-flow-row gap-4 px-6 pb-6">
      <Text variant="subtitle1">
        Personal access tokens are used to authenticate with Nhost services.
      </Text>

      <FormProvider {...form}>
        <Form onSubmit={handleSubmit} className="grid grid-flow-row gap-4">
          <Input
            {...register('name')}
            id="name"
            label="Name"
            autoFocus
            fullWidth
            helperText={formState.errors.name?.message || 'Enter a unique name'}
            error={Boolean(formState.errors.name)}
          />

          <ControlledSelect
            placeholder="Select date"
            slotProps={{
              popper: { disablePortal: false, className: 'z-[10000]' },
            }}
            id="expiresAt"
            name="expiresAt"
            label="Expiration"
            fullWidth
            helperText={formState.errors.expiresAt?.message}
            error={Boolean(formState.errors.expiresAt)}
          >
            <Option value={getStringifiedDateOffset(7)}>7 days</Option>
            <Option value={getStringifiedDateOffset(14)}>14 days</Option>
            <Option value={getStringifiedDateOffset(30)}>30 days</Option>
            <Option value={getStringifiedDateOffset(60)}>60 days</Option>
            <Option value={getStringifiedDateOffset(90)}>90 days</Option>
            <Option value={getStringifiedDateOffset(180)}>180 days</Option>
            <Option
              value={getStringifiedDateOffset(getDaysUntilNextYearSameDay())}
            >
              1 year
            </Option>
          </ControlledSelect>

          <Box className="grid grid-flow-row gap-2">
            <Button type="submit" loading={formState.isSubmitting}>
              Create
            </Button>

            <Button variant="outlined" color="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </Box>
        </Form>
      </FormProvider>
    </Box>
  );
}
