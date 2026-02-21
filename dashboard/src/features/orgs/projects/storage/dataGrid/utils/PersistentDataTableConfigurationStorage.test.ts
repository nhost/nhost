import { localStorageMock, setInitialStore } from '@/tests/testUtils';
import {
  COLUMN_CONFIGURATION_STORAGE_KEY,
  convertToV8IfNeeded,
  getColumnOrder,
  getColumnVisibility,
  saveColumnOrder,
  saveColumnVisibility,
  toggleColumnVisibility,
} from './PersistentDataTableConfigurationStorage';

describe('PersistentDataTableConfigurationStorage', () => {
  const TABLE_PATH = 'default.public.myTable';
  const CONFIG_HAS_BEEN_CONVERTED_TO_V8_KEY = 'nhost_has_been_converted_to_v8';

  beforeAll(() => {
    global.localStorage = localStorageMock();
  });

  beforeEach(() => {
    localStorage.clear();
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
    const columnVisibility = getColumnVisibility(TABLE_PATH);

    expect(columnVisibility).toStrictEqual({ column1: false, column2: false });
  });

  it('should return an empty array if there are no hidden columns for the tablePath', () => {
    const columnVisibility = getColumnVisibility(
      'default.public.no_hidden_columns',
    );

    expect(columnVisibility).toStrictEqual({});
  });

  it('should save the new hidden column state', () => {
    saveColumnVisibility(TABLE_PATH, {});

    const columnVisibility = getColumnVisibility(TABLE_PATH);

    expect(columnVisibility).toStrictEqual({});

    saveColumnVisibility('newTable', {
      Hello: false,
      There: false,
    });
    const newTableColumnVisibility = getColumnVisibility('newTable');
    expect(newTableColumnVisibility).toStrictEqual({
      Hello: false,
      There: false,
    });
  });

  it('should toggle the columns visibility', () => {
    toggleColumnVisibility(TABLE_PATH, 'column2');

    const updatedColumnVisibility = getColumnVisibility(TABLE_PATH);

    expect(updatedColumnVisibility).toStrictEqual({
      column2: true,
      column1: false,
    });
  });

  it('should default to true if the column is not in the storage and toggle it to false', () => {
    toggleColumnVisibility(TABLE_PATH, 'column3');

    const updatedColumnVisibility = getColumnVisibility(TABLE_PATH);

    expect(updatedColumnVisibility).toStrictEqual({
      column1: false,
      column2: false,
      column3: false,
    });
  });

  it('should get the column order', () => {
    const columnOrder = getColumnOrder(TABLE_PATH);

    expect(columnOrder).toStrictEqual(['column3', 'column1', 'column2']);
  });

  it('should return an empty array when there is no saved state', () => {
    const columnOrder = getColumnOrder('default.public.no_saved_column_order');

    expect(columnOrder).toStrictEqual([]);
  });

  it('should save the new column order', () => {
    const columnOrder = getColumnOrder(TABLE_PATH);

    expect(columnOrder).toStrictEqual(['column3', 'column1', 'column2']);

    saveColumnOrder(TABLE_PATH, ['column2', 'column1']);
    const newColumnOrder = getColumnOrder(TABLE_PATH);
    expect(newColumnOrder).toStrictEqual(['column2', 'column1']);
  });

  it('should convert old hiddenColumns format to v8 columnVisibility', () => {
    const MOVIES_TABLE = 'default.public.movies';
    const BOOKS_TABLE = 'default.public.books';

    setInitialStore({
      [COLUMN_CONFIGURATION_STORAGE_KEY]: JSON.stringify({
        [MOVIES_TABLE]: {
          hiddenColumns: ['director', 'rating'],
          columnOrder: ['title', 'year', 'director', 'rating'],
        },
        [BOOKS_TABLE]: {
          hiddenColumns: ['isbn'],
          columnOrder: ['title', 'author', 'isbn'],
        },
      }),
    });

    convertToV8IfNeeded();

    const moviesConfig = getColumnVisibility(MOVIES_TABLE);
    const booksConfig = getColumnVisibility(BOOKS_TABLE);

    expect(moviesConfig).toStrictEqual({ director: false, rating: false });
    expect(booksConfig).toStrictEqual({ isbn: false });
    expect(localStorage.getItem(CONFIG_HAS_BEEN_CONVERTED_TO_V8_KEY)).toBe(
      'true',
    );
  });

  it('should not convert if already converted', () => {
    const MOVIES_TABLE = 'default.public.movies';
    const initialStore = {
      [COLUMN_CONFIGURATION_STORAGE_KEY]: JSON.stringify({
        [MOVIES_TABLE]: {
          hiddenColumns: ['director'],
          columnOrder: ['title', 'director'],
        },
      }),
      [CONFIG_HAS_BEEN_CONVERTED_TO_V8_KEY]: 'true',
    };
    setInitialStore(initialStore);

    convertToV8IfNeeded();

    const storedData = JSON.parse(
      localStorage.getItem(COLUMN_CONFIGURATION_STORAGE_KEY) || '{}',
    );
    expect(storedData[MOVIES_TABLE]).toHaveProperty('hiddenColumns');
    expect(storedData[MOVIES_TABLE]).not.toHaveProperty('columnVisibility');
  });
});
