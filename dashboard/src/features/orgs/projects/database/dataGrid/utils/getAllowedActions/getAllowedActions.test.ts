import { describe, expect, test } from 'vitest';
import getAllowedActions from './getAllowedActions';

describe('getAllowedActions', () => {
  test('should return all actions for ORDINARY TABLE', () => {
    expect(getAllowedActions('ORDINARY TABLE')).toEqual([
      'insert',
      'select',
      'update',
      'delete',
    ]);
  });

  test('should return all actions for FOREIGN TABLE', () => {
    expect(getAllowedActions('FOREIGN TABLE')).toEqual([
      'insert',
      'select',
      'update',
      'delete',
    ]);
  });

  test('should return select only for MATERIALIZED VIEW without updatability', () => {
    expect(getAllowedActions('MATERIALIZED VIEW')).toEqual(['select']);
  });

  test('should return select only for MATERIALIZED VIEW with updatability 0', () => {
    expect(getAllowedActions('MATERIALIZED VIEW', 0)).toEqual(['select']);
  });

  test('should return all actions for VIEW without updatability', () => {
    expect(getAllowedActions('VIEW')).toEqual([
      'insert',
      'select',
      'update',
      'delete',
    ]);
  });

  test('should return select only when updatability is 0', () => {
    expect(getAllowedActions('VIEW', 0)).toEqual(['select']);
  });

  test('should return insert and select when updatability is 8', () => {
    expect(getAllowedActions('VIEW', 8)).toEqual(['insert', 'select']);
  });

  test('should return select and update when updatability is 4', () => {
    expect(getAllowedActions('VIEW', 4)).toEqual(['select', 'update']);
  });

  test('should return select and delete when updatability is 16', () => {
    expect(getAllowedActions('VIEW', 16)).toEqual(['select', 'delete']);
  });

  test('should return all actions when updatability is 28', () => {
    expect(getAllowedActions('VIEW', 28)).toEqual([
      'insert',
      'select',
      'update',
      'delete',
    ]);
  });

  test('should return all actions when objectType is undefined and updatability is undefined', () => {
    expect(getAllowedActions()).toEqual([
      'insert',
      'select',
      'update',
      'delete',
    ]);
  });
});
