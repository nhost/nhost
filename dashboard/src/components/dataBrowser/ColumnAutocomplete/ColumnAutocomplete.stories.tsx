import Form from '@/components/common/Form';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import type { ComponentMeta, ComponentStory } from '@storybook/react';
import { rest } from 'msw';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { ColumnAutocompleteProps } from './ColumnAutocomplete';
import ColumnAutocomplete from './ColumnAutocomplete';

export default {
  title: 'Data Browser / ColumnAutocomplete',
  component: ColumnAutocomplete,
  parameters: {
    docs: {
      source: {
        type: 'code',
      },
    },
  },
} as ComponentMeta<typeof ColumnAutocomplete>;

const Template: ComponentStory<typeof ColumnAutocomplete> = function Template(
  args: ColumnAutocompleteProps,
) {
  const [submittedValues, setSubmittedValues] = useState<string>('');

  const form = useForm<{ firstReference: string; secondReference: string }>({
    defaultValues: {
      firstReference: null,
      secondReference: null,
    },
  });

  function handleSubmit(values: {
    firstReference: string;
    secondReference: string;
  }) {
    setSubmittedValues(JSON.stringify(values, null, 2));
  }

  return (
    <div className="grid grid-flow-row gap-2">
      <FormProvider {...form}>
        <Form onSubmit={handleSubmit} className="grid grid-flow-row gap-2">
          <ColumnAutocomplete
            {...args}
            name="firstReference"
            label="First Reference"
            onChange={(_event, value) =>
              form.setValue('firstReference', value.value, {
                shouldDirty: true,
              })
            }
          />
          <ColumnAutocomplete
            {...args}
            name="secondReference"
            label="Second Reference"
            onChange={(_event, value) =>
              form.setValue('secondReference', value.value, {
                shouldDirty: true,
              })
            }
          />

          <Button type="submit" className="justify-self-start">
            Submit
          </Button>
        </Form>
      </FormProvider>

      <Text component="pre" className="!font-mono !text-gray-700">
        {submittedValues || 'The form has not been submitted yet.'}
      </Text>
    </div>
  );
};

export const Default = Template.bind({});

Default.args = {
  schema: 'public',
  table: 'books',
};

Default.parameters = {
  nextRouter: {
    path: '/[workspaceSlug]/[appSlug]/database/browser/[dataSourceSlug]/[schemaSlug]/[tableSlug]',
    asPath: '/workspace/app/database/browser/default/public/users',
    query: {
      workspaceSlug: 'workspace',
      appSlug: 'app',
      dataSourceSlug: 'default',
      schemaSlug: 'public',
      tableSlug: 'books',
    },
  },
  msw: {
    handlers: [
      rest.post('http://localhost:1337/v2/query', async (req, res, ctx) => {
        const body = await req.json();

        if (/table_name = 'authors'/gim.exec(body.args[0].args.sql) !== null) {
          return res(
            ctx.json([
              {
                result_type: 'TuplesOk',
                result: [
                  ['row_to_json'],
                  [
                    '{"table_catalog":"pqfgbylcwyuertjcrmgy","table_schema":"public","table_name":"authors","column_name":"id","ordinal_position":1,"column_default":"gen_random_uuid()","is_nullable":"NO","data_type":"uuid","character_maximum_length":null,"character_octet_length":null,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"pqfgbylcwyuertjcrmgy","udt_schema":"pg_catalog","udt_name":"uuid","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"1","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","is_primary":true,"is_unique":true,"column_comment":null}',
                  ],
                  [
                    '{"table_catalog":"pqfgbylcwyuertjcrmgy","table_schema":"public","table_name":"authors","column_name":"name","ordinal_position":2,"column_default":null,"is_nullable":"NO","data_type":"text","character_maximum_length":null,"character_octet_length":1073741824,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"pqfgbylcwyuertjcrmgy","udt_schema":"pg_catalog","udt_name":"text","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"2","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","is_primary":false,"is_unique":false,"column_comment":null}',
                  ],
                  [
                    '{"table_catalog":"pqfgbylcwyuertjcrmgy","table_schema":"public","table_name":"authors","column_name":"birth_date","ordinal_position":3,"column_default":null,"is_nullable":"NO","data_type":"timestamp without time zone","character_maximum_length":null,"character_octet_length":null,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":6,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"pqfgbylcwyuertjcrmgy","udt_schema":"pg_catalog","udt_name":"timestamp","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"3","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","is_primary":false,"is_unique":false,"column_comment":null}',
                  ],
                ],
              },
              { result_type: 'TuplesOk', result: [['row_to_json']] },
              {
                result_type: 'TuplesOk',
                result: [
                  ['row_to_json'],
                  [
                    '{"constraint_name":"authors_pkey","constraint_type":"p","constraint_definition":"PRIMARY KEY (id)","column_name":"id"}',
                  ],
                ],
              },
              { result_type: 'TuplesOk', result: [['count'], ['0']] },
            ]),
          );
        }

        return res(
          ctx.json([
            {
              result_type: 'TuplesOk',
              result: [
                ['row_to_json'],
                [
                  '{"table_catalog":"pqfgbylcwyuertjcrmgy","table_schema":"public","table_name":"books","column_name":"id","ordinal_position":1,"column_default":"gen_random_uuid()","is_nullable":"NO","data_type":"uuid","character_maximum_length":null,"character_octet_length":null,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"pqfgbylcwyuertjcrmgy","udt_schema":"pg_catalog","udt_name":"uuid","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"1","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","is_primary":true,"is_unique":true,"column_comment":null}',
                ],
                [
                  '{"table_catalog":"pqfgbylcwyuertjcrmgy","table_schema":"public","table_name":"books","column_name":"title","ordinal_position":2,"column_default":null,"is_nullable":"NO","data_type":"text","character_maximum_length":null,"character_octet_length":1073741824,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"pqfgbylcwyuertjcrmgy","udt_schema":"pg_catalog","udt_name":"text","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"2","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","is_primary":false,"is_unique":false,"column_comment":null}',
                ],
                [
                  '{"table_catalog":"pqfgbylcwyuertjcrmgy","table_schema":"public","table_name":"books","column_name":"release_date","ordinal_position":3,"column_default":null,"is_nullable":"NO","data_type":"timestamp without time zone","character_maximum_length":null,"character_octet_length":null,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":6,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"pqfgbylcwyuertjcrmgy","udt_schema":"pg_catalog","udt_name":"timestamp","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"3","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","is_primary":false,"is_unique":false,"column_comment":null}',
                ],
                [
                  '{"table_catalog":"pqfgbylcwyuertjcrmgy","table_schema":"public","table_name":"books","column_name":"author_id","ordinal_position":4,"column_default":null,"is_nullable":"NO","data_type":"uuid","character_maximum_length":null,"character_octet_length":null,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"pqfgbylcwyuertjcrmgy","udt_schema":"pg_catalog","udt_name":"uuid","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"4","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","is_primary":false,"is_unique":false,"column_comment":null}',
                ],
              ],
            },
            { result_type: 'TuplesOk', result: [['row_to_json']] },
            {
              result_type: 'TuplesOk',
              result: [
                ['row_to_json'],
                [
                  '{"constraint_name":"books_author_id_fkey","constraint_type":"f","constraint_definition":"FOREIGN KEY (author_id) REFERENCES authors(id) ON UPDATE RESTRICT ON DELETE RESTRICT","column_name":"author_id"}',
                ],
                [
                  '{"constraint_name":"books_pkey","constraint_type":"p","constraint_definition":"PRIMARY KEY (id)","column_name":"id"}',
                ],
              ],
            },
            { result_type: 'TuplesOk', result: [['count'], ['0']] },
          ]),
        );
      }),
      rest.post('http://localhost:1337/v1/metadata', (req, res, ctx) =>
        res(
          ctx.json({
            metadata: {
              version: 3,
              sources: [
                {
                  name: 'default',
                  kind: 'postgres',
                  tables: [
                    {
                      table: { name: 'authors', schema: 'public' },
                      array_relationships: [
                        {
                          name: 'books',
                          using: {
                            foreign_key_constraint_on: {
                              column: 'author_id',
                              table: { name: 'books', schema: 'public' },
                            },
                          },
                        },
                      ],
                    },
                    {
                      table: { name: 'books', schema: 'public' },
                      object_relationships: [
                        {
                          name: 'author',
                          using: { foreign_key_constraint_on: 'author_id' },
                        },
                      ],
                    },
                  ],
                  configuration: {
                    connection_info: {
                      database_url: { from_env: 'HASURA_GRAPHQL_DATABASE_URL' },
                      isolation_level: 'read-committed',
                      pool_settings: {
                        connection_lifetime: 600,
                        idle_timeout: 180,
                        max_connections: 50,
                        retries: 1,
                      },
                      use_prepared_statements: true,
                    },
                  },
                },
              ],
            },
            resource_version: 10,
          }),
        ),
      ),
    ],
  },
};
