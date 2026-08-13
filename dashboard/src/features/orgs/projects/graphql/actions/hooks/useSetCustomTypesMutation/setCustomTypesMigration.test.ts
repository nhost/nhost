import type { CustomTypes } from '@/utils/hasura-api/generated/schemas';
import { buildSetCustomTypesMigrationRequest } from './setCustomTypesMigration';

const customTypes: CustomTypes = {
  objects: [{ name: 'NewType', fields: [{ name: 'id', type: 'uuid!' }] }],
};

const previousCustomTypes: CustomTypes = {
  objects: [{ name: 'OldType', fields: [{ name: 'id', type: 'uuid!' }] }],
};

describe('buildSetCustomTypesMigrationRequest', () => {
  it('uses a generic custom types migration name', () => {
    const request = buildSetCustomTypesMigrationRequest({
      customTypes,
      previousCustomTypes,
    });

    expect(request.name).toBe('update_custom_types');
    expect(request.datasource).toBe('default');
    expect(request.skip_execution).toBe(false);
  });

  it('uses the provided migration name when given', () => {
    const request = buildSetCustomTypesMigrationRequest({
      customTypes,
      previousCustomTypes,
      migrationName: 'save_rel_animal_on_ExchangeRatesOutput',
    });

    expect(request.name).toBe('save_rel_animal_on_ExchangeRatesOutput');
  });

  it('sets the new types up and restores the previous types down', () => {
    const request = buildSetCustomTypesMigrationRequest({
      customTypes,
      previousCustomTypes,
    });

    expect(request.up).toEqual([
      { type: 'set_custom_types', args: customTypes },
    ]);
    expect(request.down).toEqual([
      { type: 'set_custom_types', args: previousCustomTypes },
    ]);
  });
});
