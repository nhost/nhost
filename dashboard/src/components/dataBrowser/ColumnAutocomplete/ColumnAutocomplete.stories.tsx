import type { ComponentMeta, ComponentStory } from '@storybook/react';
import { rest } from 'msw';
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
  const form = useForm<{ column: string }>();

  return (
    <FormProvider {...form}>
      <ColumnAutocomplete {...args} name="column" />
    </FormProvider>
  );
};

export const Default = Template.bind({});
Default.parameters = {
  nextRouter: {
    path: '/[workspaceSlug]/[appSlug]/database/browser/[dataSourceSlug]/[schemaSlug]/[tableSlug]',
    asPath: '/workspace/app/database/browser/default/public/users',
    query: {
      workspaceSlug: 'workspace',
      appSlug: 'app',
      dataSourceSlug: 'default',
      schemaSlug: 'public',
      tableSlug: 'users',
    },
  },
  msw: {
    handlers: [
      rest.post('http://localhost:1337/v2/query', (req, res, ctx) =>
        res(
          ctx.json([
            {
              result: [
                ['row_to_json'],
                [
                  '{"table_catalog":"hjdrpghqwypskcokccok","table_schema":"public","table_name":"sample_table","column_name":"id","ordinal_position":1,"column_default":"gen_random_uuid()","is_nullable":"NO","data_type":"uuid","character_maximum_length":null,"character_octet_length":null,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"hjdrpghqwypskcokccok","udt_schema":"pg_catalog","udt_name":"uuid","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"1","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","is_primary":true,"is_unique":true,"column_comment":null}',
                ],
                [
                  '{"table_catalog":"hjdrpghqwypskcokccok","table_schema":"public","table_name":"sample_table","column_name":"title","ordinal_position":2,"column_default":null,"is_nullable":"NO","data_type":"text","character_maximum_length":null,"character_octet_length":1073741824,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"hjdrpghqwypskcokccok","udt_schema":"pg_catalog","udt_name":"text","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"2","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","is_primary":false,"is_unique":false,"column_comment":null}',
                ],
                [
                  '{"table_catalog":"hjdrpghqwypskcokccok","table_schema":"public","table_name":"sample_table","column_name":"release_date","ordinal_position":3,"column_default":null,"is_nullable":"NO","data_type":"timestamp without time zone","character_maximum_length":null,"character_octet_length":null,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":6,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"hjdrpghqwypskcokccok","udt_schema":"pg_catalog","udt_name":"timestamp","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"3","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","is_primary":false,"is_unique":false,"column_comment":null}',
                ],
              ],
            },
            { result: [] },
            { result: [] },
            { result: [] },
          ]),
        ),
      ),
    ],
  },
};
Default.args = {
  schema: 'public',
  table: 'users',
};
