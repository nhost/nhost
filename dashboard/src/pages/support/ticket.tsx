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
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  useGetAllWorkspacesAndProjectsQuery,
  type GetAllWorkspacesAndProjectsQuery,
} from '@/utils/__generated__/graphql';
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

const validationSchema = Yup.object({
  workspace: Yup.string().label('Project').required(),
  project: Yup.string().label('Project').required(),
  service: Yup.string().label('Service').required(),
  severity: Yup.string().label('Severity').required(),
  subject: Yup.string().label('Subject').required(),
  description: Yup.string().label('Description').optional(),
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
      service: '',
      severity: '',
      subject: '',
      description: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  const user = useUserData();

  const { data } = useGetAllWorkspacesAndProjectsQuery({
    skip: !user,
  });

  const workspaces: Workspace[] = data?.workspaces || [];

  const projects = workspaces.flatMap((workspace) =>
    workspace.projects.map((proj) => ({
      projectSubdomain: proj.subdomain,
      projectName: proj.name,
    })),
  );

  const handleSubmit = async (formValues: CreateTicketFormValues) => {
    const {
      // workspace,
      project,
      // service,
      severity,
      subject,
      description,
    } = formValues;

    const auth = btoa(
      `${process.env.NEXT_PUBLIC_ZENDESK_USER_EMAIL}/token:${process.env.NEXT_PUBLIC_ZENDESK_API_KEY}`,
    );

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
                priority: severity,
                requester: {
                  name: user?.displayName,
                  email: user?.email,
                },
                custom_fields: [
                  {
                    id: 19502784542098,
                    value: project,
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
      <div className="flex flex-col w-full max-w-3xl">
        <div className="flex flex-col items-center mb-4">
          <Text variant="h4" className="font-bold">
            Nhost Support
          </Text>
          <Text variant="h4">How can we help you?</Text>
        </div>
        <Box className="w-full p-10 border rounded-md">
          <Box className="grid grid-flow-row gap-4">
            <Box className="flex flex-col gap-4">
              <FormProvider {...form}>
                <Form
                  onSubmit={handleSubmit}
                  className="grid grid-flow-row gap-4"
                >
                  <Text className="font-bold">Which project is affected ?</Text>

                  <ControlledSelect
                    id="workspace"
                    name="workspace"
                    label="Workspace"
                    placeholder="Workspace"
                    slotProps={{
                      root: { className: 'grid grid-flow-col gap-1' },
                    }}
                    renderValue={(option) => (
                      <span className="inline-grid items-center grid-flow-col gap-2">
                        {option?.label}
                      </span>
                    )}
                  >
                    {workspaces.map((workspace) => (
                      <Option
                        value={workspace.id}
                        key={workspace.name}
                        label={workspace.name}
                      >
                        {workspace.name}
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
                    renderValue={(option) => (
                      <span className="inline-grid items-center grid-flow-col gap-2">
                        {option?.label}
                      </span>
                    )}
                  >
                    {projects.map((proj) => (
                      <Option
                        key={proj.projectSubdomain}
                        label={proj.projectName}
                        value={proj.projectSubdomain}
                      >
                        <div className="flex flex-col">{proj.projectName}</div>
                      </Option>
                    ))}
                  </ControlledSelect>

                  <Divider />

                  <Text className="mt-4 font-bold">Impact</Text>

                  <ControlledSelect
                    id="service"
                    name="service"
                    label="Service"
                    placeholder="Service"
                    slotProps={{
                      root: { className: 'grid grid-flow-col gap-1' },
                    }}
                    renderValue={(option) => (
                      <span className="inline-grid items-center grid-flow-col gap-2">
                        {option?.label}
                      </span>
                    )}
                  >
                    {[
                      'Dashboard',
                      'Auth',
                      'Postgres',
                      'Hasura',
                      'Storage',
                      'Functions',
                      'Run',
                      'AI',
                      'CLI',
                      'Other',
                    ].map((service) => (
                      <Option key={service} label={service} value={service}>
                        {service}
                      </Option>
                    ))}
                  </ControlledSelect>

                  <ControlledSelect
                    id="severity"
                    name="severity"
                    label="Severity"
                    placeholder="Severity"
                    slotProps={{
                      root: { className: 'grid grid-flow-col gap-1 mb-4' },
                    }}
                    renderValue={(option) => (
                      <span className="inline-grid items-center grid-flow-col gap-2">
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
                    ].map((severity) => (
                      <Option
                        key={severity.title}
                        label={severity.title}
                        value={severity.title}
                      >
                        <div className="flex flex-col">
                          <span>{severity.title}</span>
                          <span className="font-mono text-xs opacity-50">
                            {severity.description}
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
                    placeholder="Subject"
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
                    placeholder="Description"
                    fullWidth
                    multiline
                    inputProps={{
                      className: 'resize-y min-h-[120px]',
                    }}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />

                  <Box className="flex flex-col gap-4 ml-auto w-80">
                    <Text color="secondary" className="text-sm text-right">
                      We will contact you at <strong>{user?.email}</strong>
                    </Text>
                    <Button
                      variant="outlined"
                      className=" hover:!bg-white hover:!bg-opacity-10 focus:ring-0"
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
    <AuthenticatedLayout
      title="Help & Support | Nhost"
      contentContainerProps={{
        className: 'flex w-full flex-col h-screen overflow-auto',
      }}
    >
      {page}
    </AuthenticatedLayout>
  );
};

export default TicketPage;
