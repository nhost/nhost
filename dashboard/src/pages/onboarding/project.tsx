import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { Button } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUserData } from '@/hooks/useUserData';
import { analytics } from '@/lib/segment';
import {
  useInsertOrgApplicationMutation,
  usePrefetchNewAppQuery,
} from '@/utils/__generated__/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { ReactElement, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import slugify from 'slugify';
import { z } from 'zod';

const projectSchema = z.object({
  projectName: z
    .string()
    .min(1, 'Project name is required')
    .max(32, 'Project name must be 32 characters or less'),
  regionId: z.string().min(1, 'Please select a region'),
});

type ProjectFormData = z.infer<typeof projectSchema>;

export default function OnboardingProjectPage() {
  const router = useRouter();
  const user = useUserData();
  const { orgs, loading: loadingOrgs } = useOrgs();
  const { data: regionsData, loading: loadingRegions } = usePrefetchNewAppQuery(
    {
      skip: !user,
    },
  );
  const [insertApp] = useInsertOrgApplicationMutation();
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectName: '',
      regionId: '',
    },
  });

  const selectedOrg = orgs?.[0]
    ? {
        id: orgs[0].id,
        name: orgs[0].name,
        slug: orgs[0].slug,
        plan: orgs[0].plan?.name,
      }
    : null;

  // set default region when regions data is loaded
  useEffect(() => {
    if (regionsData?.regions?.length > 0 && !form.getValues('regionId')) {
      const activeRegion = regionsData.regions.find((region) => region.active);
      if (activeRegion) {
        form.setValue('regionId', activeRegion.id);
      }
    }
  }, [regionsData, form]);

  const onSubmit = async (data: ProjectFormData) => {
    if (!selectedOrg) {
      return;
    }

    const slug = slugify(data.projectName, { lower: true, strict: true });

    await execPromiseWithErrorToast(
      async () => {
        const { data: { insertApp: { subdomain } = {} } = {} } =
          await insertApp({
            variables: {
              app: {
                name: data.projectName,
                slug,
                organizationID: selectedOrg.id,
                regionId: data.regionId,
              },
            },
          });

        if (subdomain) {
          const metadata = localStorage.getItem('metadata');
          const parsedMetadata = metadata ? JSON.parse(metadata) : {};

          // we only track the org creation here if it is a starter plan
          // this is because in case of a paid plan, we track the org creation in the verify page
          if (selectedOrg.plan === 'Starter') {
            analytics.track('Organization Created', {
              organizationId: selectedOrg.id,
              organizationSlug: selectedOrg.slug,
              organizationName: selectedOrg.name,
              organizationPlan: selectedOrg.plan,
              organizationOwnerId: user?.id,
              organizationOwnerEmail: user?.email,
              organizationMetadata: parsedMetadata,
              isOnboarding: true,
            });
          }

          analytics.track('Project Created', {
            projectName: data.projectName,
            projectSlug: slug,
            organizationId: selectedOrg.id,
            organizationName: selectedOrg.name,
            regionId: data.regionId,
            isOnboarding: true,
          });

          // clear onboarding flow and redirect to project dashboard
          sessionStorage.removeItem('onboarding');
          router.push(`/orgs/${selectedOrg.slug}/projects/${subdomain}`);
        }
      },
      {
        loadingMessage: 'Creating your project...',
        successMessage: 'Project created successfully!',
        errorMessage: 'Failed to create project. Please try again.',
      },
    );
  };

  if (loadingOrgs || loadingRegions) {
    return (
      <Container>
        <div className="flex h-screen items-center justify-center">
          <ActivityIndicator />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mx-auto max-w-2xl py-12">
        <div className="mb-8 flex items-center justify-center">
          <div className="flex items-center space-x-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-sm font-medium text-white">
              ✓
            </div>
            <div className="h-1 w-16 bg-green-600" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              2
            </div>
          </div>
        </div>

        <Box className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 text-center">
            <Text variant="h2" className="mb-2 text-2xl font-bold">
              Create Your First Project
            </Text>
            <Text className="text-muted-foreground">
              Projects contain your backend services, database, and APIs
            </Text>
          </div>
          <div>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My awesome project" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="regionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a region" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {regionsData?.regions?.map((region) => (
                            <SelectItem
                              key={region.id}
                              value={region.id}
                              disabled={!region.active}
                            >
                              <div className="flex items-center space-x-3">
                                <Image
                                  src={`/assets/flags/${region.country.code}.svg`}
                                  alt={`${region.country.name} flag`}
                                  width={16}
                                  height={12}
                                />
                                <span>
                                  {region.city}, {region.country.name}
                                  {!region.active && ' (Disabled)'}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedOrg && (
                  <div className="rounded-lg bg-muted p-4">
                    <Text className="mb-1 text-sm text-muted-foreground">
                      Organization
                    </Text>
                    <div className="flex items-center space-x-2">
                      <Image
                        src="/logos/new.svg"
                        alt="Organization"
                        width={20}
                        height={20}
                      />
                      <Text className="font-medium">{selectedOrg.name}</Text>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    {form.formState.isSubmitting ? (
                      <>
                        <ActivityIndicator className="mr-2 h-4 w-4" />
                        Creating Project...
                      </>
                    ) : (
                      'Create Project'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </Box>
      </div>
    </Container>
  );
}

OnboardingProjectPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="Onboarding - Create Project">
      {page}
    </AuthenticatedLayout>
  );
};
