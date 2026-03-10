import { describe, expect, it } from 'vitest';
import getDatabaseObjectDefinitionSQL from './getDatabaseObjectDefinitionSQL';

describe('getDatabaseObjectDefinitionSQL', () => {
  it('should return empty string when viewDefinition is empty', () => {
    expect(
      getDatabaseObjectDefinitionSQL('public', 'my_view', '', 'VIEW'),
    ).toBe('');
  });

  it('should return CREATE OR REPLACE VIEW for a regular view', () => {
    const result = getDatabaseObjectDefinitionSQL(
      'public',
      'active_users',
      'SELECT id, name FROM users WHERE active = true;',
      'VIEW',
    );

    expect(result).toBe(
      `CREATE OR REPLACE VIEW "public"."active_users" AS\nSELECT id, name FROM users WHERE active = true;`,
    );
  });

  it('should return DROP + CREATE for a materialized view', () => {
    const result = getDatabaseObjectDefinitionSQL(
      'analytics',
      'daily_stats',
      'SELECT date, count(*) FROM events GROUP BY date;',
      'MATERIALIZED VIEW',
    );

    expect(result).toBe(
      `DROP MATERIALIZED VIEW "analytics"."daily_stats";\nCREATE MATERIALIZED VIEW "analytics"."daily_stats" AS\nSELECT date, count(*) FROM events GROUP BY date;`,
    );
  });
});
