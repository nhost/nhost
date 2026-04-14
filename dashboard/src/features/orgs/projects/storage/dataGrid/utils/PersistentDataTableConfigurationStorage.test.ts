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
  });

  it('should convert columnOrder even when there are no hiddenColumns', () => {
    const MOVIES_TABLE = 'default.public.movies';

    setInitialStore({
      [COLUMN_CONFIGURATION_STORAGE_KEY]: JSON.stringify({
        [MOVIES_TABLE]: {
          hiddenColumns: [],
          columnOrder: ['title', 'year', 'director'],
        },
      }),
    });

    convertToV8IfNeeded();

    const columnOrder = getColumnOrder(MOVIES_TABLE);
    expect(columnOrder).toStrictEqual([
      'selection-column',
      'title',
      'year',
      'director',
    ]);
  });

  it('should convert both hiddenColumns and columnOrder independently', () => {
    const MOVIES_TABLE = 'default.public.movies';

    setInitialStore({
      [COLUMN_CONFIGURATION_STORAGE_KEY]: JSON.stringify({
        [MOVIES_TABLE]: {
          hiddenColumns: ['director'],
          columnOrder: ['title', 'year', 'director'],
        },
      }),
    });

    convertToV8IfNeeded();

    const columnVisibility = getColumnVisibility(MOVIES_TABLE);
    const columnOrder = getColumnOrder(MOVIES_TABLE);

    expect(columnVisibility).toStrictEqual({ director: false });
    expect(columnOrder).toStrictEqual([
      'selection-column',
      'title',
      'year',
      'director',
    ]);
  });

  it('should be idempotent — calling convertToV8IfNeeded twice should not duplicate selection-column', () => {
    const MOVIES_TABLE = 'default.public.movies';

    setInitialStore({
      [COLUMN_CONFIGURATION_STORAGE_KEY]: JSON.stringify({
        [MOVIES_TABLE]: {
          hiddenColumns: ['director'],
          columnOrder: ['title', 'year', 'director'],
        },
      }),
    });

    convertToV8IfNeeded();
    convertToV8IfNeeded();

    const columnOrder = getColumnOrder(MOVIES_TABLE);
    expect(columnOrder).toStrictEqual([
      'selection-column',
      'title',
      'year',
      'director',
    ]);

    const columnVisibility = getColumnVisibility(MOVIES_TABLE);
    expect(columnVisibility).toStrictEqual({ director: false });
  });

  it('should only convert old-format entries when mixed with v8 entries', () => {
    const MOVIES_TABLE = 'default.public.movies';
    const BOOKS_TABLE = 'default.public.books';

    setInitialStore({
      [COLUMN_CONFIGURATION_STORAGE_KEY]: JSON.stringify({
        [MOVIES_TABLE]: {
          hiddenColumns: ['director'],
          columnOrder: ['title', 'director'],
        },
        [BOOKS_TABLE]: {
          columnVisibility: { isbn: false },
          columnOrder: ['selection-column', 'title', 'isbn'],
        },
      }),
    });

    convertToV8IfNeeded();

    expect(getColumnVisibility(MOVIES_TABLE)).toStrictEqual({
      director: false,
    });
    expect(getColumnOrder(MOVIES_TABLE)).toStrictEqual([
      'selection-column',
      'title',
      'director',
    ]);

    expect(getColumnVisibility(BOOKS_TABLE)).toStrictEqual({ isbn: false });
    expect(getColumnOrder(BOOKS_TABLE)).toStrictEqual([
      'selection-column',
      'title',
      'isbn',
    ]);
  });

  it('should not convert if data is already in v8 format', () => {
    const MOVIES_TABLE = 'default.public.movies';

    setInitialStore({
      [COLUMN_CONFIGURATION_STORAGE_KEY]: JSON.stringify({
        [MOVIES_TABLE]: {
          columnVisibility: { director: false },
          columnOrder: ['selection-column', 'title', 'director'],
        },
      }),
    });

    convertToV8IfNeeded();

    const columnVisibility = getColumnVisibility(MOVIES_TABLE);
    const columnOrder = getColumnOrder(MOVIES_TABLE);

    expect(columnVisibility).toStrictEqual({ director: false });
    expect(columnOrder).toStrictEqual([
      'selection-column',
      'title',
      'director',
    ]);
  });
});
