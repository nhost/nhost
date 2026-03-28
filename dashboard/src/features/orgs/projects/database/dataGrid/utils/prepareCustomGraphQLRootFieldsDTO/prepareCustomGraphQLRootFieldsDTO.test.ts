import { test } from 'vitest';
import type { CustomGraphQLRootFieldsFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditGraphQLSettingsForm/sections/CustomGraphQLRootFieldsSection/CustomGraphQLRootFieldsFormTypes';
import type {
  CustomRootFields,
  TableConfig,
} from '@/utils/hasura-api/generated/schemas';
import prepareCustomGraphQLRootFieldsDTO from './prepareCustomGraphQLRootFieldsDTO';

const defaultFormValues: CustomGraphQLRootFieldsFormValues = {
  customTableName: '',
  queryAndSubscription: {
    select: {
      fieldName: '',
      comment: '',
    },
    selectByPk: {
      fieldName: '',
      comment: '',
    },
    selectAggregate: {
      fieldName: '',
      comment: '',
    },
    selectStream: {
      fieldName: '',
      comment: '',
    },
  },
  mutation: {
    insert: {
      fieldName: '',
      comment: '',
    },
    insertOne: {
      fieldName: '',
      comment: '',
    },
    update: {
      fieldName: '',
      comment: '',
    },
    updateByPk: {
      fieldName: '',
      comment: '',
    },
    updateMany: {
      fieldName: '',
      comment: '',
    },
    delete: {
      fieldName: '',
      comment: '',
    },
    deleteByPk: {
      fieldName: '',
      comment: '',
    },
  },
};

describe('prepareCustomGraphQLRootFieldsDTO', () => {
  test('should prepare a new config with valid custom root fields', () => {
    const formValues: CustomGraphQLRootFieldsFormValues = {
      ...defaultFormValues,
      queryAndSubscription: {
        ...defaultFormValues.queryAndSubscription,
        select: {
          fieldName: '',
          comment: 'example comment',
        },
        selectByPk: {
          fieldName: 'something',
          comment: '',
        },
      },
      mutation: {
        ...defaultFormValues.mutation,
        insert: {
          fieldName: 'insertUser',
          comment: 'insert a user',
        },
      },
    };

    const dto = prepareCustomGraphQLRootFieldsDTO(formValues, {});
    const expectedRootFields: CustomRootFields = {
      insert: {
        comment: 'insert a user',
        name: 'insertUser',
      },
      select: {
        comment: 'example comment',
        name: null,
      },
      select_by_pk: 'something',
    };

    expect(dto.custom_root_fields).toEqual(expectedRootFields);
  });

  test('should prepare a new config from a previous config', () => {
    const formValues: CustomGraphQLRootFieldsFormValues = {
      ...defaultFormValues,
      queryAndSubscription: {
        ...defaultFormValues.queryAndSubscription,
        select: {
          fieldName: '',
          comment: 'example comment',
        },
        selectByPk: {
          fieldName: 'something',
          comment: '',
        },
      },
      mutation: {
        ...defaultFormValues.mutation,
        insert: {
          fieldName: 'insertUser',
          comment: 'insert a user',
        },
      },
    };

    const prevConfig: TableConfig = {
      comment: 'example comment',
      column_config: {
        age: {
          custom_name: 'age',
        },
        name: {
          custom_name: 'namecustomname',
        },
      },
      custom_column_names: {
        age: 'age',
        name: 'namecustomname',
      },
      custom_root_fields: {},
    };

    const dto = prepareCustomGraphQLRootFieldsDTO(formValues, prevConfig);

    const expected: TableConfig = {
      custom_name: null,
      column_config: {
        age: {
          custom_name: 'age',
        },
        name: {
          custom_name: 'namecustomname',
        },
      },
      custom_root_fields: {
        select: {
          name: null,
          comment: 'example comment',
        },
        select_by_pk: 'something',
        insert: {
          name: 'insertUser',
          comment: 'insert a user',
        },
      },
    };
    expect(dto).toEqual(expected);
  });
});
