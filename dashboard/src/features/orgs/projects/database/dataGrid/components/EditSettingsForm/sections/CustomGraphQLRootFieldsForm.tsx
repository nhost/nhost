import { SettingsContainer } from '@/components/layout/SettingsContainer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
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
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const fieldSchema = z.object({
  fieldName: z.string().optional(),
  commentEnabled: z.boolean(),
  comment: z.string().optional(),
});

const validationSchema = z.object({
  customTableName: z.string().optional(),
  queryAndSubscription: z.object({
    select: fieldSchema,
    selectByPk: fieldSchema,
    selectAggregate: fieldSchema,
    selectStream: fieldSchema,
  }),
  mutation: z.object({
    insert: fieldSchema,
    insertOne: fieldSchema,
    update: fieldSchema,
    updateByPk: fieldSchema,
    updateMany: fieldSchema,
    delete: fieldSchema,
    deleteByPk: fieldSchema,
  }),
});

type CustomGraphQLRootFieldsFormValues = z.infer<typeof validationSchema>;
type QueryFieldName =
  keyof CustomGraphQLRootFieldsFormValues['queryAndSubscription'];
type MutationFieldName = keyof CustomGraphQLRootFieldsFormValues['mutation'];

type SectionConfig<TSection extends 'queryAndSubscription' | 'mutation'> = {
  key: keyof CustomGraphQLRootFieldsFormValues[TSection];
  label: string;
  fieldPlaceholder: string;
  commentPlaceholder: string;
};

const defaultValues: CustomGraphQLRootFieldsFormValues = {
  customTableName: 'client_roles (default)',
  queryAndSubscription: {
    select: {
      fieldName: 'client_roles (default)',
      commentEnabled: true,
      comment: 'fetch data from the table: "client_roles"',
    },
    selectByPk: {
      fieldName: 'client_roles_by_pk (default)',
      commentEnabled: true,
      comment: 'fetch a single row from the table: "client_roles"',
    },
    selectAggregate: {
      fieldName: 'client_roles_aggregate (default)',
      commentEnabled: true,
      comment: 'fetch aggregate fields from the table: "client_roles"',
    },
    selectStream: {
      fieldName: 'client_roles_stream (default)',
      commentEnabled: true,
      comment: 'stream rows from the table: "client_roles"',
    },
  },
  mutation: {
    insert: {
      fieldName: 'insert_client_roles (default)',
      commentEnabled: true,
      comment: 'insert data into the table: "client_roles"',
    },
    insertOne: {
      fieldName: 'insert_client_roles_one (default)',
      commentEnabled: true,
      comment: 'insert a single row into the table: "client_roles"',
    },
    update: {
      fieldName: 'update_client_roles (default)',
      commentEnabled: true,
      comment: 'update data of the table: "client_roles"',
    },
    updateByPk: {
      fieldName: 'update_client_roles_by_pk (default)',
      commentEnabled: true,
      comment: 'update a single row of the table: "client_roles"',
    },
    updateMany: {
      fieldName: 'update_many_client_roles (default)',
      commentEnabled: true,
      comment: 'update data for "many" operations of the table: "client_roles"',
    },
    delete: {
      fieldName: 'delete_client_roles (default)',
      commentEnabled: true,
      comment: 'delete data from the table: "client_roles"',
    },
    deleteByPk: {
      fieldName: 'delete_client_roles_by_pk (default)',
      commentEnabled: true,
      comment: 'delete a single row from the table: "client_roles"',
    },
  },
};

const queryFields: SectionConfig<'queryAndSubscription'>[] = [
  {
    key: 'select',
    label: 'Select',
    fieldPlaceholder: 'client_roles (default)',
    commentPlaceholder: 'fetch data from the table',
  },
  {
    key: 'selectByPk',
    label: 'Select by PK',
    fieldPlaceholder: 'client_roles_by_pk (default)',
    commentPlaceholder: 'fetch a single row from the table',
  },
  {
    key: 'selectAggregate',
    label: 'Select aggregate',
    fieldPlaceholder: 'client_roles_aggregate (default)',
    commentPlaceholder: 'fetch aggregate fields from the table',
  },
  {
    key: 'selectStream',
    label: 'Select stream',
    fieldPlaceholder: 'client_roles_stream (default)',
    commentPlaceholder: 'stream rows from the table',
  },
] as const;

const mutationFields: SectionConfig<'mutation'>[] = [
  {
    key: 'insert',
    label: 'Insert',
    fieldPlaceholder: 'insert_client_roles (default)',
    commentPlaceholder: 'insert data into the table',
  },
  {
    key: 'insertOne',
    label: 'Insert one',
    fieldPlaceholder: 'insert_client_roles_one (default)',
    commentPlaceholder: 'insert a single row into the table',
  },
  {
    key: 'update',
    label: 'Update',
    fieldPlaceholder: 'update_client_roles (default)',
    commentPlaceholder: 'update data of the table',
  },
  {
    key: 'updateByPk',
    label: 'Update by PK',
    fieldPlaceholder: 'update_client_roles_by_pk (default)',
    commentPlaceholder: 'update a single row of the table',
  },
  {
    key: 'updateMany',
    label: 'Update many',
    fieldPlaceholder: 'update_many_client_roles (default)',
    commentPlaceholder: 'update data for "many" operations of the table',
  },
  {
    key: 'delete',
    label: 'Delete',
    fieldPlaceholder: 'delete_client_roles (default)',
    commentPlaceholder: 'delete data from the table',
  },
  {
    key: 'deleteByPk',
    label: 'Delete by PK',
    fieldPlaceholder: 'delete_client_roles_by_pk (default)',
    commentPlaceholder: 'delete a single row from the table',
  },
] as const;

export default function CustomGraphQLRootFieldsForm() {
  const form = useForm<CustomGraphQLRootFieldsFormValues>({
    defaultValues,
    resolver: zodResolver(validationSchema),
  });

  const { formState } = form;

  const handleSubmit = form.handleSubmit(async () => {
    // TODO: Integrate with the data grid settings API.
  });
  type QueryFieldNamePath = `queryAndSubscription.${QueryFieldName}.fieldName`;
  type QueryCommentEnabledPath =
    `queryAndSubscription.${QueryFieldName}.commentEnabled`;
  type QueryCommentPath = `queryAndSubscription.${QueryFieldName}.comment`;

  type MutationFieldNamePath = `mutation.${MutationFieldName}.fieldName`;
  type MutationCommentEnabledPath =
    `mutation.${MutationFieldName}.commentEnabled`;
  type MutationCommentPath = `mutation.${MutationFieldName}.comment`;

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col gap-4 overflow-y-auto px-6 pb-4"
      >
        <SettingsContainer
          title="Custom GraphQL Root Fields"
          description="Configure the root field names and optional comments exposed in your GraphQL API."
          topRightElement={
            <Button variant="outline" size="sm">
              Close
            </Button>
          }
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <FormField
            control={form.control}
            name="customTableName"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Custom Table Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="client_roles (default)" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="rounded-lg border border-border">
            <Accordion
              type="multiple"
              defaultValue={['mutation']}
              className="rounded-lg"
            >
              <AccordionItem
                value="query-and-subscription"
                className="overflow-hidden border-border"
              >
                <AccordionTrigger className="px-4 text-sm font-semibold">
                  Query and Subscription
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-3">
                    <div className="grid grid-cols-[160px,minmax(0,1fr),140px,minmax(0,1fr)] items-center gap-3 rounded-md bg-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span />
                      <span>Field Name</span>
                      <span className="col-span-2">Comment</span>
                    </div>
                    {queryFields.map((fieldConfig) => {
                      const fieldNamePath =
                        `queryAndSubscription.${fieldConfig.key}.fieldName` as QueryFieldNamePath;
                      const commentEnabledPath =
                        `queryAndSubscription.${fieldConfig.key}.commentEnabled` as QueryCommentEnabledPath;
                      const commentPath =
                        `queryAndSubscription.${fieldConfig.key}.comment` as QueryCommentPath;

                      return (
                        <div
                          key={`query-${String(fieldConfig.key)}`}
                          className="grid grid-cols-[160px,minmax(0,1fr),140px,minmax(0,1fr)] items-start gap-3 rounded-md border border-border/80 bg-background px-4 py-3"
                        >
                          <span className="pt-2 text-sm font-medium text-foreground">
                            {fieldConfig.label}
                          </span>
                          <FormField
                            control={form.control}
                            name={fieldNamePath}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder={fieldConfig.fieldPlaceholder}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={commentEnabledPath}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <Select
                                  value={field.value ? 'value' : 'none'}
                                  onValueChange={(value) =>
                                    field.onChange(value === 'value')
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Value" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="value">Value</SelectItem>
                                    <SelectItem value="none">None</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={commentPath}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder={fieldConfig.commentPlaceholder}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="mutation"
                className="overflow-hidden border-border"
              >
                <AccordionTrigger className="px-4 text-sm font-semibold">
                  Mutation
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid gap-3">
                    <div className="grid grid-cols-[160px,minmax(0,1fr),140px,minmax(0,1fr)] items-center gap-3 rounded-md bg-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span />
                      <span>Field Name</span>
                      <span className="col-span-2">Comment</span>
                    </div>
                    {mutationFields.map((fieldConfig) => {
                      const fieldNamePath =
                        `mutation.${fieldConfig.key}.fieldName` as MutationFieldNamePath;
                      const commentEnabledPath =
                        `mutation.${fieldConfig.key}.commentEnabled` as MutationCommentEnabledPath;
                      const commentPath =
                        `mutation.${fieldConfig.key}.comment` as MutationCommentPath;

                      return (
                        <div
                          key={`mutation-${String(fieldConfig.key)}`}
                          className="grid grid-cols-[160px,minmax(0,1fr),140px,minmax(0,1fr)] items-start gap-3 rounded-md border border-border/80 bg-background px-4 py-3"
                        >
                          <span className="pt-2 text-sm font-medium text-foreground">
                            {fieldConfig.label}
                          </span>
                          <FormField
                            control={form.control}
                            name={fieldNamePath}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder={fieldConfig.fieldPlaceholder}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={commentEnabledPath}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <Select
                                  value={field.value ? 'value' : 'none'}
                                  onValueChange={(value) =>
                                    field.onChange(value === 'value')
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Value" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="value">Value</SelectItem>
                                    <SelectItem value="none">None</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={commentPath}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder={fieldConfig.commentPlaceholder}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </SettingsContainer>
      </form>
    </Form>
  );
}
