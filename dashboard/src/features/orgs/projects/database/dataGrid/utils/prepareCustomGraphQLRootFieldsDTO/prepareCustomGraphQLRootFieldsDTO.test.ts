import { type CustomGraphQLRootFieldsFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditSettingsForm/sections/CustomGraphQLRootFieldsSection/CustomGraphQLRootFieldsFormTypes';
import { test } from 'vitest';
import prepareCustomGraphQLRootFieldsDTO from './prepareCustomGraphQLRootFieldsDTO';

const defaultValues: CustomGraphQLRootFieldsFormValues = {
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
  test('should prepare a DTO', () => {
    const formValues: CustomGraphQLRootFieldsFormValues = {
      ...defaultValues,
      queryAndSubscription: {
        ...defaultValues.queryAndSubscription,
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
        ...defaultValues.mutation,
        insert: {
          fieldName: 'insertUser',
          comment: 'insert a user',
        },
      },
    };

    const dto = prepareCustomGraphQLRootFieldsDTO(formValues);

    const expected = {
      select: {
        name: null,
        comment: 'example comment',
      },
      select_by_pk: 'something',
      insert: {
        name: 'insertUser',
        comment: 'insert a user',
      },
    };
    expect(dto).toEqual(expected);
  });
});
