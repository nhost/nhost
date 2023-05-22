import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/common/Form';
import { HighlightedText } from '@/components/common/HighlightedText';
import type { DialogFormProps } from '@/types/common';
import { Alert } from '@/ui/Alert';
import { Box } from '@/ui/v2/Box';
import { Button } from '@/ui/v2/Button';
import { IconButton } from '@/ui/v2/IconButton';
import { Input } from '@/ui/v2/Input';
import { Text } from '@/ui/v2/Text';
import { CopyIcon } from '@/ui/v2/icons/CopyIcon';
import { GetPersonalAccessTokensDocument } from '@/utils/__generated__/graphql';
import copy from '@/utils/copy';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { useApolloClient } from '@apollo/client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNhostClient } from '@nhost/nextjs';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export const createPATFormValidationSchema = Yup.object({
  name: Yup.string().label('Name').nullable().required(),
  expiresAt: Yup.string().label('Expires at').nullable().required(),
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
        { name: formValues.name },
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
            fullWidth
            helperText={formState.errors.name?.message}
            error={Boolean(formState.errors.name)}
          />

          <Input
            {...register('expiresAt')}
            type="date"
            id="expires-at"
            label="Expires at"
            fullWidth
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
            helperText={formState.errors.expiresAt?.message}
            error={Boolean(formState.errors.expiresAt)}
          />

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
