import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import { Input } from '@/components/ui/v3/input';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';

import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { StripeEmbeddedForm } from '@/features/orgs/StripeEmbeddedForm';
import { planDescriptions } from '@/features/projects/common/utils/planDescriptions';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  useCreateOrganizationRequestMutation,
  usePrefetchNewAppQuery,
  type PrefetchNewAppPlansFragment,
} from '@/utils/__generated__/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { DialogDescription } from '@radix-ui/react-dialog';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const createOrgFormSchema = z.object({
  name: z.string().min(2),
  plan: z.optional(z.string()),
});

interface CreateOrgFormProps {
  plans: PrefetchNewAppPlansFragment[];
  onSubmit?: ({
    name,
    plan,
  }: z.infer<typeof createOrgFormSchema>) => Promise<void>;
}

function CreateOrgForm({ plans, onSubmit }: CreateOrgFormProps) {
  const form = useForm<z.infer<typeof createOrgFormSchema>>({
    resolver: zodResolver(createOrgFormSchema),
    defaultValues: {
      name: '',
      plan: plans[0].id,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Inc" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="plan"
          render={({ field }) => (
            <FormItem className="">
              <div>
                <FormLabel>Plan</FormLabel>
                <FormDescription className="text-xs">
                  You can change this later
                </FormDescription>
              </div>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  {plans.map((plan) => (
                    <FormItem key={plan.id}>
                      <FormLabel className="flex w-full cursor-pointer flex-row items-center justify-between space-y-0 rounded-md border p-3">
                        <div className="flex flex-row items-center space-x-3">
                          <FormControl>
                            <RadioGroupItem value={plan.id} />
                          </FormControl>
                          <div className="flex flex-col space-y-2">
                            <div className="text-md font-semibold">
                              {plan.name}
                            </div>
                            <FormDescription className="w-2/3 text-xs">
                              {planDescriptions[plan.name]}
                            </FormDescription>
                          </div>
                        </div>

                        <div className="mt-0 flex h-full items-center text-xl font-semibold">
                          {plan.isFree ? 'Free' : `${plan.price}/mo`}
                        </div>
                      </FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            variant="secondary"
            type="button"
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <ActivityIndicator />
            ) : (
              'Create organization'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function CreateOrgDialog() {
  const [open, setOpen] = useState(false);
  const { data, loading, error } = usePrefetchNewAppQuery();
  const [createOrganizationRequest] = useCreateOrganizationRequestMutation();
  const [stripeClientSecret, setStripeClientSecret] = useState('');

  const createOrg = async ({
    name,
  }: // plan,
  {
    name?: string;
    plan?: string;
  }) => {
    await execPromiseWithErrorToast(
      async () => {
        const {
          data: { billingCreateOrganizationRequest: clientSecret },
        } = await createOrganizationRequest({
          variables: {
            organizationName: name,
            planID: 'dc5e805e-1bef-4d43-809e-9fdf865e211a',
            redirectURL: 'http://localhost:3000/orgs/verify',
          },
        });

        setStripeClientSecret(clientSecret);
      },
      {
        loadingMessage: 'Redirecting to checkout',
        successMessage: 'Success',
        errorMessage: 'An error occurred while redirecting to checkout!',
      },
    );
  };

  if (error) {
    throw error;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-full flex-row justify-start gap-3 px-2"
          onClick={() => setStripeClientSecret('')}
        >
          <Plus className="h-4 w-4 font-bold" strokeWidth={3} />
          New Organization
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New Organization</DialogTitle>
          <DialogDescription />
        </DialogHeader>

        {loading && (
          <div className="flex h-52 items-center justify-center">
            <ActivityIndicator
              circularProgressProps={{
                className: 'w-5 h-5',
              }}
            />
          </div>
        )}
        {!loading && !stripeClientSecret && (
          <CreateOrgForm plans={data?.plans} onSubmit={createOrg} />
        )}
        {!loading && stripeClientSecret && (
          <StripeEmbeddedForm clientSecret={stripeClientSecret} />
        )}
      </DialogContent>
    </Dialog>
  );
}
