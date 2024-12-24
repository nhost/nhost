import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Form } from '@/components/form/Form';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { EnvelopeIcon } from '@/components/ui/v2/icons/EnvelopeIcon';
import { Input, inputClasses } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import {
  useGetAllWorkspacesAndProjectsQuery,
  useGetOrganizationsQuery,
  type GetAllWorkspacesAndProjectsQuery,
  type GetOrganizationsQuery,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { styled } from '@mui/material';
import { useUserData } from '@nhost/nextjs';
import { type ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

type Workspace = Omit<
  GetAllWorkspacesAndProjectsQuery['workspaces'][0],
  '__typename'
>;

type Organization = Omit<
  GetOrganizationsQuery['organizations'][0],
  '__typename'
>;

const validationSchema = Yup.object({
  organization: Yup.string().label('Organization'),
  workspace: Yup.string().label('Workspace'),
  project: Yup.string().label('Project').required(),
  services: Yup.array()
    .of(Yup.object({ label: Yup.string(), value: Yup.string() }))
    .label('Services')
    .required(),
  priority: Yup.string().label('Priority').required(),
  subject: Yup.string().label('Subject').required(),
  description: Yup.string().label('Description').required(),
  ccs: Yup.string().label('CCs').optional(),
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
      workspace: '',
      project: '',
      services: [],
      priority: '',
      subject: '',
      description: '',
      ccs: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const selectedWorkspace = watch('workspace');
  const selectedOrganization = watch('organization');
  const user = useUserData();

  const { data } = useGetAllWorkspacesAndProjectsQuery({
    skip: !user,
  });
  const { data: organizationsData } = useGetOrganizationsQuery({
    variables: {
      userId: user?.id,
    },
  });

  const workspaces: Workspace[] = data?.workspaces || [];
  const organizations: Organization[] = organizationsData?.organizations || [];

  const getAvailableProjects = () => {
    if (selectedOrganization) {
      return (
        organizations.find((org) => org.id === selectedOrganization)?.apps || []
      );
    }
    if (selectedWorkspace) {
      return (
        workspaces.find((workspace) => workspace.id === selectedWorkspace)
          ?.projects || []
      );
    }

    return [];
  };

  const handleSubmit = async (formValues: CreateTicketFormValues) => {
    const { project, services, priority, subject, description, ccs } =
      formValues;

    const auth = btoa(
      `${process.env.NEXT_PUBLIC_ZENDESK_USER_EMAIL}/token:${process.env.NEXT_PUBLIC_ZENDESK_API_KEY}`,
    );
    const emails = ccs
      .replace(/ /g, '')
      .split(',')
      .map((email) => ({ user_email: email }));

    await execPromiseWithErrorToast(
      async () => {
        await fetch(
          `${process.env.NEXT_PUBLIC_ZENDESK_URL}/api/v2/requests.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify({
              request: {
                subject,
                comment: {
                  body: description,
                },
                priority,
                requester: {
                  name: user?.displayName,
                  email: user?.email,
                },
                email_ccs: emails,
                custom_fields: [
                  // these custom field IDs come from zendesk
                  {
                    id: 19502784542098,
                    value: project,
                  },
                  {
                    id: 19922709880978,
                    value: services.map((service) =>
                      service.value.toLowerCase(),
                    ),
                  },
                ],
              },
            }),
          },
        );
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

                  <Box className="grid grid-cols-[1fr,auto,1fr] items-start gap-4">
                    <ControlledSelect
                      id="organization"
                      name="organization"
                      label="Organization"
                      placeholder="Organization"
                      slotProps={{
                        root: { className: 'grid grid-flow-col gap-1' },
                      }}
                      error={!!errors.organization}
                      helperText={errors.organization?.message}
                      disabled={!!selectedWorkspace}
                      renderValue={(option) => (
                        <span className="inline-grid grid-flow-col items-center gap-2">
                          {option?.label}
                        </span>
                      )}
                    >
                      <Option value="" label="" />
                      {organizations.map((organization) => (
                        <Option
                          key={organization.name}
                          value={organization.id}
                          label={organization.name}
                        >
                          {organization.name}
                        </Option>
                      ))}
                    </ControlledSelect>

                    <Text className="mt-[34px] text-center font-medium">
                      or
                    </Text>

                    <ControlledSelect
                      id="workspace"
                      name="workspace"
                      label="Workspace"
                      placeholder="Workspace"
                      slotProps={{
                        root: { className: 'grid grid-flow-col gap-1' },
                      }}
                      error={!!errors.workspace}
                      helperText={errors.workspace?.message}
                      disabled={!!selectedOrganization}
                      renderValue={(option) => (
                        <span className="inline-grid grid-flow-col items-center gap-2">
                          {option?.label}
                        </span>
                      )}
                    >
                      <Option value="" label="" />
                      {workspaces.map((workspace) => (
                        <Option
                          key={workspace.name}
                          value={workspace.id}
                          label={workspace.name}
                        >
                          {workspace.name}
                        </Option>
                      ))}
                    </ControlledSelect>
                  </Box>

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
                    slotProps={{
                      root: { className: 'grid grid-flow-col gap-1 mb-4' },
                    }}
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
                    ].map((priority) => (
                      <Option
                        key={priority.title}
                        label={priority.title}
                        value={priority.title.toLowerCase()}
                      >
                        <div className="flex flex-col">
                          <span>{priority.title}</span>
                          <span className="font-mono text-xs opacity-50">
                            {priority.description}
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
                    autoFocus
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

                  <Divider />

                  <Text className="mt-4 font-bold">Notifications</Text>

                  <StyledInput
                    {...register('ccs')}
                    id="ccs"
                    label="CCs"
                    placeholder="Comma separated list of emails you want to share this ticket with."
                    fullWidth
                    inputProps={{ min: 2, max: 128 }}
                    error={!!errors.ccs}
                    helperText={errors.ccs?.message}
                  />

                  <Box className="ml-auto flex w-80 flex-col gap-4">
                    <Text color="secondary" className="text-right text-sm">
                      We will contact you at <strong>{user?.email}</strong>
                    </Text>
                    <Button
                      variant="outlined"
                      className="hover:!bg-white hover:!bg-opacity-10 focus:ring-0"
                      size="large"
                      type="submit"
                      startIcon={<EnvelopeIcon />}
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
    <AuthenticatedLayout title="Help & Support | Nhost">
      {page}
    </AuthenticatedLayout>
  );
};

export default TicketPage;
