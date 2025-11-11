import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Form } from '@/components/form/Form';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Input, inputClasses } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useAccessToken } from '@/hooks/useAccessToken';
import { useUserData } from '@/hooks/useUserData';
import {
  useGetOrganizationsQuery,
  type GetOrganizationsQuery,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { styled } from '@mui/material';
import { Mail } from 'lucide-react';
import { useEffect, type ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

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
  const canSetPriority = slaLevel != null && slaLevel > 0;

  useEffect(() => {
    if (!!selectedOrganization && !canSetPriority && priority !== 'low') {
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
    const { project, services, priority: priorityValue, subject, description } = formValues;

    const currentSlaLevel = selectedOrg?.plan?.slaLevel ?? null;
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
            userName: user?.displayName,
            userEmail: user?.email,
            slaLevel: currentSlaLevel,
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

                  <ControlledSelect
                    id="organization"
                    name="organization"
                    label="Organization"
                    placeholder="Organization"
                    slotProps={{
                      root: { className: 'grid grid-flow-col gap-1 mb-4' },
                    }}
                    error={!!errors.organization}
                    helperText={errors.organization?.message}
                    renderValue={(option) => (
                      <span className="inline-grid grid-flow-col items-center gap-2">
                        {option?.label}
                      </span>
                    )}
                  >
                    {organizations.map((organization) => (
                      <Option
                        key={organization.id}
                        value={organization.id}
                        label={organization.name}
                      >
                        {organization.name}
                      </Option>
                    ))}
                  </ControlledSelect>

                  <ControlledSelect
                    id="project"
                    name="project"
                    label="Project"
                    placeholder="Project"
                    slotProps={{
                      root: { className: 'grid grid-flow-col gap-1 mb-4' },
                    }}
                    error={!!errors.project}
                    helperText={errors.project?.message}
                    renderValue={(option) => (
                      <span className="inline-grid grid-flow-col items-center gap-2">
                        {option?.label}
                      </span>
                    )}
                  >
                    {getAvailableProjects().map((proj) => (
                      <Option
                        key={proj.subdomain}
                        value={proj.subdomain}
                        label={proj.name}
                      >
                        <div className="flex flex-col">{proj.name}</div>
                      </Option>
                    ))}
                  </ControlledSelect>

                  <Divider />

                  <Text className="mt-4 font-bold">Impact</Text>

                  <ControlledAutocomplete
                    id="services"
                    name="services"
                    label="Services"
                    fullWidth
                    multiple
                    aria-label="Services"
                    options={[
                      'Dashboard',
                      'Database',
                      'Authentication',
                      'Storage',
                      'Hasura/APIs',
                      'Functions',
                      'Run',
                      'Graphite',
                      'Other',
                    ].map((s) => ({ label: s, value: s }))}
                    error={!!errors?.services?.message}
                    helperText={errors?.services?.message}
                  />

                  <ControlledSelect
                    id="priority"
                    name="priority"
                    label="Priority"
                    placeholder="Priority"
                    disabled={!!selectedOrganization && !canSetPriority}
                    slotProps={{
                      root: { className: 'grid grid-flow-col gap-1 mb-4' },
                    }}
                    error={!!errors.priority}
                    helperText={
                      !!selectedOrganization && !canSetPriority
                        ? 'Priority is locked to "Low" for your current plan'
                        : errors.priority?.message
                    }
                    renderValue={(option) => (
                      <span className="inline-grid grid-flow-col items-center gap-2">
                        {option?.label}
                      </span>
                    )}
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
                      <Option
                        key={p.title}
                        label={p.title}
                        value={p.title.toLowerCase()}
                      >
                        <div className="flex flex-col">
                          <span>{p.title}</span>
                          <span className="font-mono text-xs opacity-50">
                            {p.description}
                          </span>
                        </div>
                      </Option>
                    ))}
                  </ControlledSelect>

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
                      className="text-base hover:!bg-white hover:!bg-opacity-10 focus:ring-0"
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
