DROP SCHEMA IF EXISTS cfk CASCADE;
CREATE SCHEMA cfk;

CREATE TABLE cfk.parent (
  tenant_id integer NOT NULL,
  id integer NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE cfk.child (
  row_id integer PRIMARY KEY,
  tenant_id integer NOT NULL,
  account_id integer NOT NULL,
  slug text,
  include_payload text,
  expression_value text,
  deferrable_value integer,
  CONSTRAINT child_account_fkey
    FOREIGN KEY (tenant_id, account_id)
    REFERENCES cfk.parent (tenant_id, id),
  CONSTRAINT child_tenant_account_key
    UNIQUE (tenant_id, account_id),
  CONSTRAINT child_deferrable_key
    UNIQUE (deferrable_value) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE UNIQUE INDEX child_slug_idx ON cfk.child (slug);
CREATE UNIQUE INDEX child_include_idx
  ON cfk.child (slug, tenant_id) INCLUDE (include_payload);
CREATE UNIQUE INDEX child_partial_idx
  ON cfk.child (slug) WHERE tenant_id > 0;
CREATE UNIQUE INDEX child_expression_idx
  ON cfk.child (lower(expression_value));
CREATE UNIQUE INDEX child_invalid_idx ON cfk.child (expression_value);
CREATE UNIQUE INDEX child_not_ready_idx ON cfk.child (expression_value, slug);
CREATE UNIQUE INDEX child_not_live_idx ON cfk.child (expression_value, tenant_id);
CREATE UNIQUE INDEX child_non_immediate_idx
  ON cfk.child (deferrable_value, slug);

UPDATE pg_index SET indisvalid = false
WHERE indexrelid = 'cfk.child_invalid_idx'::regclass;
UPDATE pg_index SET indisready = false
WHERE indexrelid = 'cfk.child_not_ready_idx'::regclass;
UPDATE pg_index SET indislive = false
WHERE indexrelid = 'cfk.child_not_live_idx'::regclass;
UPDATE pg_index SET indimmediate = false
WHERE indexrelid = 'cfk.child_non_immediate_idx'::regclass;
