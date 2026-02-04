import { localStorageMock, setInitialStore } from '@/tests/testUtils';
import PersistenDataTableConfigurationStorage, {
  COLUMN_CONFIGURATION_STORAGE_KEY,
} from './PersistenDataTableConfigurationStorage';

describe('PersistenDataTableConfigurationStorage', () => {
  const TABLE_PATH = 'default.public.myTable';
  beforeAll(() => {
    global.localStorage = localStorageMock();
  });

  beforeEach(() => {
    setInitialStore({
      [COLUMN_CONFIGURATION_STORAGE_KEY]: JSON.stringify({
        [TABLE_PATH]: {
          columnVisibility: { column1: false, column2: false },
          columnOrder: ['column3', 'column1', 'column2'],
        },
      }),
    });
  });

  it('should return the hidden columns for the tablePath', () => {
    const columnVisibility =
      PersistenDataTableConfigurationStorage.getColumnVisibility(TABLE_PATH);

    expect(columnVisibility).toStrictEqual({ column1: false, column2: false });
  });

  it('should return an empty array if there are no hidden columns for the tablePath', () => {
    const columnVisibility =
      PersistenDataTableConfigurationStorage.getColumnVisibility(
        'default.public.no_hidden_columns',
      );

    expect(columnVisibility).toStrictEqual({});
  });

  it('should save the new hidden column state', () => {
    PersistenDataTableConfigurationStorage.saveColumnVisibility(TABLE_PATH, {});

    const columnVisibility =
      PersistenDataTableConfigurationStorage.getColumnVisibility(TABLE_PATH);

    expect(columnVisibility).toStrictEqual({});

    PersistenDataTableConfigurationStorage.saveColumnVisibility('newTable', {
      Hello: false,
      There: false,
    });
    const newTableColumnVisibility =
      PersistenDataTableConfigurationStorage.getColumnVisibility('newTable');
    expect(newTableColumnVisibility).toStrictEqual({
      Hello: false,
      There: false,
    });
  });

  it('should toggle the columns visibility', () => {
    PersistenDataTableConfigurationStorage.toggleColumnVisibility(
      TABLE_PATH,
      'column2',
    );

    const updatedColumnVisibility =
      PersistenDataTableConfigurationStorage.getColumnVisibility(TABLE_PATH);

    expect(updatedColumnVisibility).toStrictEqual({
      column2: true,
      column1: false,
    });
  });

  it('should get the column order', () => {
    const columnOrder =
      PersistenDataTableConfigurationStorage.getColumnOrder(TABLE_PATH);

    expect(columnOrder).toStrictEqual(['column3', 'column1', 'column2']);
  });

  it('should return an empty array when there is no saved state', () => {
    const columnOrder = PersistenDataTableConfigurationStorage.getColumnOrder(
      'default.public.no_saved_column_order',
    );

    expect(columnOrder).toStrictEqual([]);
  });

  it('should save the new column order', () => {
    const columnOrder =
      PersistenDataTableConfigurationStorage.getColumnOrder(TABLE_PATH);

    expect(columnOrder).toStrictEqual(['column3', 'column1', 'column2']);

    PersistenDataTableConfigurationStorage.saveColumnOrder(TABLE_PATH, [
      'column2',
      'column1',
    ]);
    const newColumnOrder =
      PersistenDataTableConfigurationStorage.getColumnOrder(TABLE_PATH);
    expect(newColumnOrder).toStrictEqual(['column2', 'column1']);
  });
});
