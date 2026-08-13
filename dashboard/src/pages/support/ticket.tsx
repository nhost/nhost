import { yupResolver } from '@hookform/resolvers/yup';
import { Mail } from 'lucide-react';
import { type ReactElement, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { ButtonWithLoading } from '@/components/ui/v3/button';
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
import { Separator } from '@/components/ui/v3/separator';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  type GetOrganizationsQuery,
  useGetOrganizationsQuery,
} from '@/generated/graphql';
import { useAccessToken } from '@/hooks/useAccessToken';
import { useUserData } from '@/hooks/useUserData';

type Organization = Omit<
  GetOrganizationsQuery['organizations'][0],
  '__typename'
>;

const validationSchema = Yup.object({
  organization: Yup.string().label('Organization').required(),
  project: Yup.string().label('Project').required(),
  services: Yup.array()
    .of(Yup.string().required())
    .label('Services')
    .required(),
  priority: Yup.string().label('Priority').required(),
  subject: Yup.string().label('Subject').required(),
  description: Yup.string().label('Description').required(),
});

export type CreateTicketFormValues = Yup.InferType<typeof validationSchema>;

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
    <div className="flex min-h-full flex-col items-center justify-center bg-background-default py-10">
      <div className="flex w-full max-w-3xl flex-col">
        <div className="mb-4 flex flex-col items-center">
          <h4 className="font-bold text-2xl">Nhost Support</h4>
          <h4 className="text-2xl">How can we help you?</h4>
        </div>
        <div className="box w-full rounded-md border p-10">
          <div className="grid grid-flow-row gap-4">
            <div className="flex flex-col gap-4">
              <FormProvider {...form}>
                <Form
                  onSubmit={handleSubmit}
                  className="grid grid-flow-row gap-4"
                >
                  <p className="font-bold">Which project is affected ?</p>

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

                  <Separator />

                  <p className="mt-4 font-bold">Impact</p>

                  <FormField
                    control={form.control}
                    name="services"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel className="font-bold">Services</FormLabel>
                        <MultiSelect
                          values={field.value ?? []}
                          onValuesChange={field.onChange}
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

                  <Separator />

                  <p className="mt-4 font-bold">Issue</p>

                  <FormInput
                    control={form.control}
                    name="subject"
                    label="Subject"
                    placeholder="Summary of the problem you are experiencing"
                  />

                  <FormTextarea
                    control={form.control}
                    name="description"
                    label="Description"
                    placeholder="Describe the issue you are experiencing in detail, along with any relevant information. Please be as detailed as possible."
                    className="min-h-[120px] resize-y"
                  />

                  <div className="ml-auto flex flex-col gap-4 lg:w-80">
                    <p className="text-right text-muted-foreground text-sm">
                      We will contact you at <strong>{user?.email}</strong>
                    </p>
                    <ButtonWithLoading
                      variant="outline"
                      className="hover:!bg-white hover:!bg-opacity-10 text-base focus:ring-0"
                      size="lg"
                      type="submit"
                      disabled={isSubmitting}
                      loading={isSubmitting}
                    >
                      {!isSubmitting && <Mail className="mr-2 size-4" />}
                      Create Support Ticket
                    </ButtonWithLoading>
                  </div>
                </Form>
              </FormProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
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
