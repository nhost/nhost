import { http, HttpResponse } from 'msw';

const tableQuery = http.post(
  'https://local.hasura.local.nhost.run/v2/query',
  async ({ request }) => {
    const body = (await request.json()) as any;
    if (/table_name = 'authors'/gim.exec(body?.args?.[0].args.sql) !== null) {
      return HttpResponse.json([
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
        {
          result_type: 'TuplesOk',
          result: [
            ['row_to_json'],
            [
              '{"constraint_name":"authors_pkey","constraint_type":"p","constraint_definition":"PRIMARY KEY (id)","column_name":"id"}',
            ],
          ],
        },
      ]);
    }

    if (/public.authors/gim.exec(body.args[0].sql) !== null) {
      return HttpResponse.json([
        { result_type: 'TuplesOk', result: [['row_to_json']] },
        { result_type: 'TuplesOk', result: [['count'], ['0']] },
      ]);
    }

    if (/table_name = 'town'/gim.exec(body.args[0].args.sql) !== null) {
      return HttpResponse.json([
        {
          result_type: 'TuplesOk',
          result: [
            ['row_to_json'],
            [
              '{"table_catalog":"local","table_schema":"public","table_name":"town","column_name":"id","ordinal_position":1,"column_default":"gen_random_uuid()","is_nullable":"NO","data_type":"uuid","character_maximum_length":null,"character_octet_length":null,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"local","udt_schema":"pg_catalog","udt_name":"uuid","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"1","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","full_data_type":"uuid","is_primary":true,"is_unique":true,"column_comment":null}',
            ],
            [
              '{"table_catalog":"local","table_schema":"public","table_name":"town","column_name":"name","ordinal_position":2,"column_default":null,"is_nullable":"NO","data_type":"text","character_maximum_length":null,"character_octet_length":1073741824,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"local","udt_schema":"pg_catalog","udt_name":"text","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"2","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","full_data_type":"text","is_primary":false,"is_unique":false,"column_comment":null}',
            ],
            [
              '{"table_catalog":"local","table_schema":"public","table_name":"town","column_name":"countyId","ordinal_position":3,"column_default":null,"is_nullable":"NO","data_type":"uuid","character_maximum_length":null,"character_octet_length":null,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"local","udt_schema":"pg_catalog","udt_name":"uuid","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"3","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","full_data_type":"uuid","is_primary":false,"is_unique":false,"column_comment":null}',
            ],
          ],
        },
        {
          result_type: 'TuplesOk',
          result: [
            ['row_to_json'],
            [
              '{"constraint_name":"town_countyId_fkey","constraint_type":"f","constraint_definition":"FOREIGN KEY (\\"countyId\\") REFERENCES county(id) ON UPDATE RESTRICT ON DELETE RESTRICT","column_name":"countyId"}',
            ],
            [
              '{"constraint_name":"town_pkey","constraint_type":"p","constraint_definition":"PRIMARY KEY (id)","column_name":"id"}',
            ],
          ],
        },
      ]);
    }

    if (/public.town/gim.exec(body.args[0].sql) !== null) {
      return HttpResponse.json([
        { result_type: 'TuplesOk', result: [['row_to_json']] },
        { result_type: 'TuplesOk', result: [['count'], ['0']] },
      ]);
    }

    if (/table_name = 'actor'/gim.exec(body.args[0].args.sql) !== null) {
      return HttpResponse.json([
        {
          result_type: 'TuplesOk',
          result: [
            ['row_to_json'],
            [
              '{"table_catalog":"klkudrtrpapfrseiidkp","table_schema":"public","table_name":"actor","column_name":"id","ordinal_position":1,"column_default":"gen_random_uuid()","is_nullable":"NO","data_type":"uuid","character_maximum_length":null,"character_octet_length":null,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"klkudrtrpapfrseiidkp","udt_schema":"pg_catalog","udt_name":"uuid","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"1","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","full_data_type":"uuid","is_primary":true,"is_unique":true,"column_comment":null}',
            ],
            [
              '{"table_catalog":"klkudrtrpapfrseiidkp","table_schema":"public","table_name":"actor","column_name":"name","ordinal_position":2,"column_default":null,"is_nullable":"NO","data_type":"text","character_maximum_length":null,"character_octet_length":1073741824,"numeric_precision":null,"numeric_precision_radix":null,"numeric_scale":null,"datetime_precision":null,"interval_type":null,"interval_precision":null,"character_set_catalog":null,"character_set_schema":null,"character_set_name":null,"collation_catalog":null,"collation_schema":null,"collation_name":null,"domain_catalog":null,"domain_schema":null,"domain_name":null,"udt_catalog":"klkudrtrpapfrseiidkp","udt_schema":"pg_catalog","udt_name":"text","scope_catalog":null,"scope_schema":null,"scope_name":null,"maximum_cardinality":null,"dtd_identifier":"2","is_self_referencing":"NO","is_identity":"NO","identity_generation":null,"identity_start":null,"identity_increment":null,"identity_maximum":null,"identity_minimum":null,"identity_cycle":"NO","is_generated":"NEVER","generation_expression":null,"is_updatable":"YES","full_data_type":"text","is_primary":false,"is_unique":false,"column_comment":null}',
            ],
          ],
        },
        {
          result_type: 'TuplesOk',
          result: [
            ['row_to_json'],
            [
              '{"constraint_name":"actor_pkey","constraint_type":"p","constraint_definition":"PRIMARY KEY (id)","column_name":"id"}',
            ],
          ],
        },
      ]);
    }

    if (/public.actor/gim.exec(body.args[0].sql) !== null) {
      return HttpResponse.json([
        {
          result_type: 'TuplesOk',
          result: [
            ['row_to_json'],
            ['{"id":"1902e481-b080-4340-abe3-27b0a60973c6","name":"There"}'],
            ['{"id":"a486b088-50e8-41d0-88b0-5bf9a3e7b5e7","name":"hello"}'],
          ],
        },
        { result_type: 'TuplesOk', result: [['count'], ['2']] },
      ]);
    }

    if (body?.args?.[1].args.sql.includes('SELECT COUNT(*)')) {
      return HttpResponse.json([
        {
          result_type: 'TuplesOk',
          result: [['row_to_json']],
        },
        {
          result_type: 'TuplesOk',
          result: [['count'], ['0']],
        },
      ]);
    }

    return HttpResponse.json([
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
    ]);
  },
);

export default tableQuery;
