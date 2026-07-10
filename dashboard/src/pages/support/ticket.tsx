import { yupResolver } from '@hookform/resolvers/yup';
import { styled } from '@mui/material';
import { Mail } from 'lucide-react';
import { type ReactElement, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { Form } from '@/components/form/Form';
import { FormSelect } from '@/components/form/FormSelect';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Input, inputClasses } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/ui/v3/multi-select';
import { SelectItem } from '@/components/ui/v3/select';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useAccessToken } from '@/hooks/useAccessToken';
import { useUserData } from '@/hooks/useUserData';
import {
  type GetOrganizationsQuery,
  useGetOrganizationsQuery,
} from '@/utils/__generated__/graphql';

type Organization = Omit<
  GetOrganizationsQuery['organizations'][0],
  '__typename'
>;

const validationSchema = Yup.object({
  organization: Yup.string().label('Organization').required(),
  project: Yup.string().label('Project').required(),
  services: Yup.array()
    .of(Yup.object({ label: Yup.string(), value: Yup.string() }))
    .label('Services')
    .required(),
  priority: Yup.string().label('Priority').required(),
  subject: Yup.string().label('Subject').required(),
  description: Yup.string().label('Description').required(),
});

export type CreateTicketFormValues = Yup.InferType<typeof validationSchema>;

const StyledInput = styled(Input)({
  backgroundColor: 'transparent',
  [`& .${inputClasses.input}`]: {
    backgroundColor: 'transparent !important',
  },
});

function TicketPage() {
  const form = useForm<CreateTicketFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      organization: '',
      project: '',
      services: [],
      priority: '',
      subject: '',
      description: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const selectedOrganization = watch('organization');
  const priority = watch('priority');
  const user = useUserData();
  const token = useAccessToken();

  const { data: organizationsData } = useGetOrganizationsQuery({
    variables: {
      userId: user?.id,
    },
  });

  const organizations: Organization[] = organizationsData?.organizations || [];

  const selectedOrg = selectedOrganization
    ? organizations.find((org) => org.id === selectedOrganization)
    : null;

  const slaLevel = selectedOrg?.plan?.slaLevel;
  const canSetPriority = typeof slaLevel === 'string' && slaLevel !== 'none';

  useEffect(() => {
    if (selectedOrganization && !canSetPriority && priority !== 'low') {
      setValue('priority', 'low', { shouldValidate: true });
    }
  }, [selectedOrganization, canSetPriority, priority, setValue]);

  const getAvailableProjects = () => {
    if (selectedOrganization) {
      return (
        organizations.find((org) => org.id === selectedOrganization)?.apps || []
      );
    }

    return [];
  };

  const handleSubmit = async (formValues: CreateTicketFormValues) => {
    const {
      project,
      services,
      priority: priorityValue,
      subject,
      description,
    } = formValues;

    await execPromiseWithErrorToast(
      async () => {
        const response = await fetch('/api/support/create-ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            project,
            services,
            priority: priorityValue,
            subject,
            description,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create ticket');
        }

        form.reset();
      },
      {
        loadingMessage: 'Creating Ticket...',
        successMessage: 'Ticket created successfully',
        errorMessage: 'Failed to create ticket',
      },
    );
  };

  return (
    <Box
      className="flex flex-col items-center justify-center py-10"
      sx={{ backgroundColor: 'background.default' }}
    >
      <div className="flex w-full max-w-3xl flex-col">
        <div className="mb-4 flex flex-col items-center">
          <Text variant="h4" className="font-bold">
            Nhost Support
          </Text>
          <Text variant="h4">How can we help you?</Text>
        </div>
        <Box className="w-full rounded-md border p-10">
          <Box className="grid grid-flow-row gap-4">
            <Box className="flex flex-col gap-4">
              <FormProvider {...form}>
                <Form
                  onSubmit={handleSubmit}
                  className="grid grid-flow-row gap-4"
                >
                  <Text className="font-bold">Which project is affected ?</Text>

                  <FormSelect
                    control={form.control}
                    name="organization"
                    label="Organization"
                    placeholder="Organization"
                    containerClassName="mb-4"
                  >
                    {organizations.map((organization) => (
                      <SelectItem key={organization.id} value={organization.id}>
                        {organization.name}
                      </SelectItem>
                    ))}
                  </FormSelect>

                  <FormSelect
                    control={form.control}
                    name="project"
                    label="Project"
                    placeholder="Project"
                    containerClassName="mb-4"
                  >
                    {getAvailableProjects().map((proj) => (
                      <SelectItem key={proj.subdomain} value={proj.subdomain}>
                        {proj.name}
                      </SelectItem>
                    ))}
                  </FormSelect>

                  <Divider />

                  <Text className="mt-4 font-bold">Impact</Text>

                  <FormField
                    control={form.control}
                    name="services"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel className="font-bold">Services</FormLabel>
                        <MultiSelect
                          values={(field.value || []).map(
                            // biome-ignore lint/suspicious/noExplicitAny: Will be fixed later.
                            (v: any) => v.value,
                          )}
                          onValuesChange={(nextValues) =>
                            field.onChange(
                              nextValues.map((v) => ({ label: v, value: v })),
                            )
                          }
                        >
                          <FormControl>
                            <MultiSelectTrigger className="w-full rounded-sm hover:bg-accent-background dark:border-[#2f363d] dark:bg-[#171d26] dark:hover:bg-[#1b2534]">
                              <MultiSelectValue
                                placeholder="Select Services"
                                placeHolderClassName="text-[#9ca7b7]"
                                overflowBehavior="wrap"
                              />
                            </MultiSelectTrigger>
                          </FormControl>
                          <MultiSelectContent>
                            <MultiSelectGroup>
                              {[
                                'Dashboard',
                                'Database',
                                'Authentication',
                                'Storage',
                                'Hasura/APIs',
                                'Functions',
                                'Run',
                                'Graphite',
                                'Other',
                              ].map((s) => (
                                <MultiSelectItem
                                  key={s}
                                  value={s}
                                  className="data-[selected='true']:bg-accent data-[selected='true']:dark:bg-[#1b2534]"
                                >
                                  {s}
                                </MultiSelectItem>
                              ))}
                            </MultiSelectGroup>
                          </MultiSelectContent>
                        </MultiSelect>
                        {!!errors?.services?.message && (
                          <FormMessage>{errors?.services?.message}</FormMessage>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormSelect
                    control={form.control}
                    name="priority"
                    label="Priority"
                    placeholder="Priority"
                    disabled={!!selectedOrganization && !canSetPriority}
                    containerClassName="mb-4"
                    helperText={
                      selectedOrganization && !canSetPriority ? (
                        <>
                          To set a higher priority, upgrade to a plan with an
                          SLA.{' '}
                          <a
                            className="text-primary hover:underline"
                            href="https://nhost.io/pricing"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View pricing
                          </a>
                        </>
                      ) : null
                    }
                    helperTextClassName="break-normal pt-2"
                  >
                    {[
                      {
                        title: 'Low',
                        description: 'General guidance',
                      },
                      {
                        title: 'Normal',
                        description: 'Non-production system impaired',
                      },
                      {
                        title: 'High',
                        description: 'Production System impaired',
                      },
                      {
                        title: 'Urgent',
                        description: 'Production system offline',
                      },
                    ].map((p) => (
                      <SelectItem
                        key={p.title}
                        value={p.title.toLowerCase()}
                        textContent={p.title}
                        className="flex-col items-start gap-1"
                      >
                        <span className="font-mono text-xs opacity-50">
                          {p.description}
                        </span>
                      </SelectItem>
                    ))}
                  </FormSelect>

                  <Divider />

                  <Text className="mt-4 font-bold">Issue</Text>

                  <StyledInput
                    {...register('subject')}
                    id="subject"
                    label="Subject"
                    placeholder="Summary of the problem you are experiencing"
                    fullWidth
                    inputProps={{ min: 2, max: 128 }}
                    error={!!errors.subject}
                    helperText={errors.subject?.message}
                  />

                  <StyledInput
                    {...register('description')}
                    id="description"
                    label="Description"
                    placeholder="Describe the issue you are experiencing in detail, along with any relevant information. Please be as detailed as possible."
                    fullWidth
                    multiline
                    inputProps={{
                      className: 'resize-y min-h-[120px]',
                    }}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />

                  <Box className="ml-auto flex flex-col gap-4 lg:w-80">
                    <Text color="secondary" className="text-right text-sm">
                      We will contact you at <strong>{user?.email}</strong>
                    </Text>
                    <Button
                      variant="outlined"
                      className="hover:!bg-white hover:!bg-opacity-10 text-base focus:ring-0"
                      size="large"
                      type="submit"
                      startIcon={<Mail className="size-4" />}
                      disabled={isSubmitting}
                      loading={isSubmitting}
                    >
                      Create Support Ticket
                    </Button>
                  </Box>
                </Form>
              </FormProvider>
            </Box>
          </Box>
        </Box>
      </div>
    </Box>
  );
}

TicketPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="Help & Support | Nhost" withMainNav={false}>
      {page}
    </AuthenticatedLayout>
  );
};

export default TicketPage;
