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
          hiddenColumns: ['column1', 'column2'],
          columnOrder: ['column3', 'column1', 'column2'],
        },
      }),
    });
  });

  it('should return the hidden columns for the tablePath', () => {
    const hiddenColumns =
      PersistenDataTableConfigurationStorage.getHiddenColumns(TABLE_PATH);

    expect(hiddenColumns).toStrictEqual(['column1', 'column2']);
  });

  it('should return an empty array if there are no hidden columns for the tablePath', () => {
    const hiddenColumns =
      PersistenDataTableConfigurationStorage.getHiddenColumns(
        'default.public.no_hidden_columns',
      );

    expect(hiddenColumns).toStrictEqual([]);
  });

  it('should save the new hidden column state', () => {
    PersistenDataTableConfigurationStorage.saveHiddenColumns(TABLE_PATH, []);

    const hiddenColumns =
      PersistenDataTableConfigurationStorage.getHiddenColumns(TABLE_PATH);

    expect(hiddenColumns).toStrictEqual([]);

    PersistenDataTableConfigurationStorage.saveHiddenColumns('newTable', [
      'Hello',
      'There',
    ]);
    const newTableHiddenColumns =
      PersistenDataTableConfigurationStorage.getHiddenColumns('newTable');
    expect(newTableHiddenColumns).toStrictEqual(['Hello', 'There']);
  });

  it('should toggle the columns visibility', () => {
    const hiddenColumns =
      PersistenDataTableConfigurationStorage.getHiddenColumns(TABLE_PATH);

    expect(hiddenColumns).toStrictEqual(['column1', 'column2']);

    PersistenDataTableConfigurationStorage.toggleColumnVisibility(
      TABLE_PATH,
      'column2',
    );

    const updatedHiddenColumns =
      PersistenDataTableConfigurationStorage.getHiddenColumns(TABLE_PATH);

    expect(updatedHiddenColumns).toStrictEqual(['column1']);
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
