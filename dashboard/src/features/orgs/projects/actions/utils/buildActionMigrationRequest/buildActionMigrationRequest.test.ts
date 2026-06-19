import { describe, expect, it } from 'vitest';
import buildActionMigrationRequest, {
  type ActionMigrationStep,
} from './buildActionMigrationRequest';

const up: ActionMigrationStep[] = [
  { type: 'set_custom_types', args: { objects: [] } },
  {
    type: 'create_action',
    args: {
      name: 'doThing',
      definition: {
        handler: 'http://localhost:3000',
        output_type: 'SampleOutput',
      },
    },
  },
];

const down: ActionMigrationStep[] = [
  { type: 'drop_action', args: { name: 'doThing' } },
  { type: 'set_custom_types', args: { objects: [] } },
];

describe('buildActionMigrationRequest', () => {
  it('stamps the default datasource and disables skip_execution', () => {
    const request = buildActionMigrationRequest('create_action_doThing', {
      up,
      down,
    });

    expect(request.name).toBe('create_action_doThing');
    expect(request.datasource).toBe('default');
    expect(request.skip_execution).toBe(false);
  });

  it('passes the up and down steps through unchanged', () => {
    const request = buildActionMigrationRequest('create_action_doThing', {
      up,
      down,
    });

    expect(request.up).toEqual(up);
    expect(request.down).toEqual(down);
  });
});
