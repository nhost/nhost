import { Form } from '@/components/form/Form';
import { Logo } from '@/components/presentational/Logo';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Input, inputClasses } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  useGetAllWorkspacesAndProjectsQuery,
  type GetAllWorkspacesAndProjectsQuery,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { styled } from '@mui/material';
import { useUserData } from '@nhost/nextjs';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

type Workspace = Omit<
  GetAllWorkspacesAndProjectsQuery['workspaces'][0],
  '__typename'
>;

const validationSchema = Yup.object({
  subject: Yup.string().label('Subject').required(),
  severity: Yup.string().label('Severity').required(),
  project: Yup.string().label('Project').required(),
  description: Yup.string().label('Description').optional(),
});

export type CreateTicketFormValues = Yup.InferType<typeof validationSchema>;

const StyledInput = styled(Input)({
  backgroundColor: 'transparent',
  [`& .${inputClasses.input}`]: {
    backgroundColor: 'transparent !important',
  },
});

export default function SupportPage() {
  const form = useForm<CreateTicketFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      subject: '',
      severity: '',
      project: '',
      description: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const { register, formState } = form;

  const [subject, setSubject] = useState('');
  const [severity, setSeverity] = useState('low');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState('');

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

  async function handleSubmit() {
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
  }

  return (
    <div className="m-20 flex flex-col items-center justify-center">
      <div className="mb-6 flex flex-col items-center">
        <Logo className="mx-auto mb-2 cursor-pointer" />
        <Text variant="h4" className="font-bold">
          Nhost Support
        </Text>
      </div>

      <Box className="w-full max-w-3xl rounded-md p-6 shadow-lg lg:p-12">
        <Text variant="h3" component="h2" className="mb-6 text-center">
          How can we help you?
        </Text>

        <Box className="grid grid-flow-row gap-4">
          <Box className="grid grid-flow-row gap-0.5 text-center">
            <Text className="font-semibold">{user?.displayName}</Text>
            <Text color="secondary" className="text-sm">
              {user?.email}
            </Text>
          </Box>

          <Divider />

          <Box className="grid grid-flow-row gap-4">
            <FormProvider {...form}>
              <Form
                onSubmit={handleSubmit}
                className="grid grid-flow-row gap-4"
              >
                <Select
                  {...register('project')}
                  id="project"
                  label="Project"
                  placeholder="Project"
                  slotProps={{
                    root: { className: 'grid grid-flow-col gap-1' },
                  }}
                  onChange={(_, value) => {
                    setProject(value as string);
                  }}
                  value={project}
                  renderValue={(option) => (
                    <span className="inline-grid grid-flow-col items-center gap-2">
                      {option?.label}
                    </span>
                  )}
                >
                  {projects.map((proj) => (
                    <Option
                      value={proj.projectSubdomain}
                      key={proj.projectSubdomain}
                    >
                      {proj.projectName} ({proj.projectSubdomain})
                    </Option>
                  ))}
                </Select>

                <StyledInput
                  {...register('subject')}
                  id="subject"
                  label="Subject"
                  placeholder="Subject"
                  fullWidth
                  autoFocus
                  inputProps={{ min: 2, max: 128 }}
                  error={!!formState.errors.subject}
                  helperText={formState.errors.subject?.message}
                  onChange={(e) => {
                    setSubject(e.target.value);
                  }}
                  value={subject}
                />

                <Select
                  {...register('severity')}
                  id="severity"
                  label="Severity"
                  placeholder="Severity"
                  slotProps={{
                    root: { className: 'grid grid-flow-col gap-1' },
                  }}
                  onChange={(_, value) => {
                    setSeverity(value as string);
                  }}
                  value={severity}
                  renderValue={(option) => (
                    <span className="inline-grid grid-flow-col items-center gap-2">
                      {option?.label}
                    </span>
                  )}
                >
                  <Option value="low" key="low">
                    Low
                  </Option>
                  <Option value="medium" key="medium">
                    Medium
                  </Option>
                  <Option value="high" key="high">
                    High
                  </Option>
                  <Option value="urgent" key="urgent">
                    Urgent
                  </Option>
                </Select>

                <StyledInput
                  {...register('description')}
                  id="description"
                  label="Description"
                  placeholder="Description"
                  fullWidth
                  multiline
                  inputProps={{ min: 2, max: 128 }}
                  error={!!formState.errors.description}
                  helperText={formState.errors.description?.message}
                  onChange={(e) => {
                    setDescription(e.target.value);
                  }}
                  value={description}
                />

                <Button
                  variant="outlined"
                  className="hover:!bg-white hover:!bg-opacity-10 focus:ring-0"
                  size="large"
                  type="submit"
                  disabled={formState.isSubmitting}
                  loading={formState.isSubmitting}
                  // onClick={handleSubmit}
                >
                  Create Support Ticket
                </Button>
              </Form>
            </FormProvider>
          </Box>
        </Box>
      </Box>
    </div>
  );
}
