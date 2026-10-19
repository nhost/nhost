/*
This upgrade is the set of objects added by pg_jsonschema 0.3.4.
The SQL below is copied from the pgrx-generated pg_jsonschema--0.3.4.sql.
*/

/* <begin connected objects> */
-- src/compiled/mod.rs:18
-- JsonSchema
CREATE TYPE JsonSchema;

-- src/compiled/mod.rs:18
-- pg_jsonschema::compiled::jsonschema_in
CREATE  FUNCTION "jsonschema_in"(
	"input" cstring /* Option < & :: core :: ffi :: CStr > */
) RETURNS JsonSchema /* Option < JsonSchema > */
IMMUTABLE PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'jsonschema_in_wrapper';

-- src/compiled/mod.rs:18
-- pg_jsonschema::compiled::jsonschema_out
CREATE  FUNCTION "jsonschema_out"(
	"input" JsonSchema /* JsonSchema */
) RETURNS cstring /* :: pgrx :: ffi :: CString */
IMMUTABLE STRICT PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'jsonschema_out_wrapper';

-- src/compiled/mod.rs:18
-- JsonSchema
CREATE TYPE JsonSchema (
	INTERNALLENGTH = variable,
	INPUT = jsonschema_in, /* pg_jsonschema::compiled::jsonschema_in */
	OUTPUT = jsonschema_out, /* pg_jsonschema::compiled::jsonschema_out */
	STORAGE = extended
);
/* </end connected objects> */

/* <begin connected objects> */
-- src/lib.rs:74
-- pg_jsonschema::jsonb_matches_compiled_schema
CREATE  FUNCTION "jsonb_matches_compiled_schema"(
	"schema" JsonSchema, /* JsonSchema */
	"instance" jsonb /* pgrx :: JsonB */
) RETURNS bool /* bool */
IMMUTABLE STRICT PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'jsonb_matches_compiled_schema_wrapper';
/* </end connected objects> */

/* <begin connected objects> */
-- src/compiled/mod.rs:19
-- pg_jsonschema::compiled::jsonschema_ne
CREATE  FUNCTION "jsonschema_ne"(
	"left" JsonSchema, /* JsonSchema */
	"right" JsonSchema /* JsonSchema */
) RETURNS bool /* bool */
IMMUTABLE STRICT PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'jsonschema_ne_wrapper';

-- src/compiled/mod.rs:19
-- pg_jsonschema::compiled::jsonschema_ne
CREATE OPERATOR <> (
	PROCEDURE="jsonschema_ne",
	LEFTARG=JsonSchema, /* JsonSchema */
	RIGHTARG=JsonSchema, /* JsonSchema */
	COMMUTATOR = <>,
	NEGATOR = =,
	RESTRICT = neqsel,
	JOIN = neqjoinsel
);
/* </end connected objects> */

/* <begin connected objects> */
-- src/lib.rs:47
-- pg_jsonschema::jsonschema_from_jsonb
CREATE  FUNCTION "jsonschema_from_jsonb"(
	"schema" jsonb /* pgrx :: JsonB */
) RETURNS JsonSchema /* JsonSchema */
IMMUTABLE STRICT PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'jsonschema_from_jsonb_wrapper';
/* </end connected objects> */

/* <begin connected objects> */
-- src/lib.rs:97
-- pg_jsonschema::jsonb_validation_errors_compiled
CREATE  FUNCTION "jsonb_validation_errors_compiled"(
	"schema" JsonSchema, /* JsonSchema */
	"instance" jsonb /* pgrx :: JsonB */
) RETURNS TEXT[] /* Vec < String > */
IMMUTABLE STRICT PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'jsonb_validation_errors_compiled_wrapper';
/* </end connected objects> */

/* <begin connected objects> */
-- src/lib.rs:64
-- pg_jsonschema::json_matches_compiled_schema
CREATE  FUNCTION "json_matches_compiled_schema"(
	"schema" JsonSchema, /* JsonSchema */
	"instance" json /* Json */
) RETURNS bool /* bool */
IMMUTABLE STRICT PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'json_matches_compiled_schema_wrapper';
/* </end connected objects> */

/* <begin connected objects> */
-- src/lib.rs:42
-- pg_jsonschema::jsonschema_from_json
CREATE  FUNCTION "jsonschema_from_json"(
	"schema" json /* pgrx :: Json */
) RETURNS JsonSchema /* JsonSchema */
IMMUTABLE STRICT PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'jsonschema_from_json_wrapper';
/* </end connected objects> */

/* <begin connected objects> */
-- src/lib.rs:52
-- requires:
--   jsonschema_from_json
--   jsonschema_from_jsonb


    CREATE CAST (json AS jsonschema)
        WITH FUNCTION jsonschema_from_json(json);

    CREATE CAST (jsonb AS jsonschema)
        WITH FUNCTION jsonschema_from_jsonb(jsonb);
/* </end connected objects> */

/* <begin connected objects> */
-- src/compiled/mod.rs:19
-- pg_jsonschema::compiled::jsonschema_eq
CREATE  FUNCTION "jsonschema_eq"(
	"left" JsonSchema, /* JsonSchema */
	"right" JsonSchema /* JsonSchema */
) RETURNS bool /* bool */
IMMUTABLE STRICT PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'jsonschema_eq_wrapper';

-- src/compiled/mod.rs:19
-- pg_jsonschema::compiled::jsonschema_eq
CREATE OPERATOR = (
	PROCEDURE="jsonschema_eq",
	LEFTARG=JsonSchema, /* JsonSchema */
	RIGHTARG=JsonSchema, /* JsonSchema */
	COMMUTATOR = =,
	NEGATOR = <>,
	RESTRICT = eqsel,
	JOIN = eqjoinsel,
	HASHES,
	MERGES
);
/* </end connected objects> */

/* <begin connected objects> */
-- src/lib.rs:84
-- pg_jsonschema::json_validation_errors_compiled
CREATE  FUNCTION "json_validation_errors_compiled"(
	"schema" JsonSchema, /* JsonSchema */
	"instance" json /* Json */
) RETURNS TEXT[] /* Vec < String > */
IMMUTABLE STRICT PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'json_validation_errors_compiled_wrapper';
/* </end connected objects> */

/* <begin connected objects> */
-- src/compiled/mod.rs:20
-- pg_jsonschema::compiled::jsonschema_hash
CREATE  FUNCTION "jsonschema_hash"(
	"value" JsonSchema /* JsonSchema */
) RETURNS INT /* i32 */
IMMUTABLE STRICT PARALLEL SAFE
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'jsonschema_hash_wrapper';
/* </end connected objects> */

/* <begin connected objects> */
-- src/compiled/mod.rs:20
-- JsonSchema
CREATE OPERATOR FAMILY JsonSchema_hash_ops USING hash;
CREATE OPERATOR CLASS JsonSchema_hash_ops DEFAULT FOR TYPE JsonSchema USING hash FAMILY JsonSchema_hash_ops AS
	OPERATOR    1   =  (JsonSchema, JsonSchema),
	FUNCTION    1   jsonschema_hash(JsonSchema);
/* </end connected objects> */
