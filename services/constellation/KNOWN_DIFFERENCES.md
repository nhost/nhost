# Aggregates on non-aggregatable types

1. Aggregation, increments and ordering support for the type is discovered rather than hardcoded, this means:
   - types where the above is not supported in hasura but where the type actually supports it (e.g. vector) will now work as expected
   - min/max support is detected from explicit aggregate functions and from types with default btree operator classes (which support min/max via polymorphic aggregates like `min(anynonarray)`)
   - Hasura hardcodes which types support min/max and excludes types like bool, jsonb, and bytea even though PostgreSQL supports them. Constellation discovers support dynamically, so these types may appear in `_max_fields`, `_min_fields`, `_max_order_by`, and `_min_order_by` types when the database reports aggregate support for them.

2. Array-typed columns (e.g. `[String!]`, `[uuid!]`) are excluded from `_max_fields`, `_min_fields`, `_max_order_by`, and `_min_order_by` types.

3. If all columns of a table are non-aggregatable (e.g. only jsonb columns), the `max`/`min` fields are omitted from the `_aggregate_fields` type entirely rather than exposing empty types.

# Mutations with no update permissions

Update mutations are not generated for tables where the role has no update column permissions (i.e. the `_update_column` enum only contains `_PLACEHOLDER`). Hasura generates these mutations but they cannot actually update any columns, making them no-ops.

# Functions

Functions can return either SETOF <table> (0-many rows) or just <table> (exactly one row). Hasura allows filtering, ordering and limitting on functions that return <table>, which feels wrong since the function is only supposed to return one row. Hence, constellation does not expose where, limit, order_by, etc for functions that return a single row.

For the same reason, constellation does not generate the `_aggregate` root field for functions that return a single row. Aggregating over exactly one row has no meaningful use, so the field is omitted in query and subscription roots. Hasura emits it uniformly for any table-returning function.

Function arguments without a default value are exposed as non-null (`uuid!`) in `_args` input types. Hasura always makes them nullable (`uuid`) regardless of whether they have a default. Neither behavior is wrong since PostgreSQL will reject a missing required argument at execution time either way.

## Permissions

Constellation does not infer permissions for functions (HASURA_GRAPHQL_INFER_FUNCTION_PERMISSIONS=false and not configurable) and need to be set explicitly. Otherwise, permissions work the same way as in hasura:

1. User needs select permissions on the return type of the function in addition to the permissions on the function itself.
2. Column permissions on the return type are applied to the result of the function.
3. Row level permissions on the return type are applied to the result of the function.
4. No permissions are applied on the input or on what the function does internally but the session can be passed and leveraged inside the function for permission checks. For instance:

```sql
CREATE OR REPLACE FUNCTION public.set_department_manager(p_user_id UUID, p_department_id UUID, session json)
RETURNS public.user_departments
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  result public.user_departments;
BEGIN
  IF session->>'x-hasura-role' != 'admin'
     AND NOT (p_department_id = ANY(COALESCE(session->>'x-hasura-department-manager', '{}')::uuid[])) THEN
    RAISE EXCEPTION 'Permission denied: not a manager of department %', p_department_id;
  END IF;

  -- Remove existing manager(s) for this department
  UPDATE public.user_departments
  SET role = 'member'
  WHERE department_id = p_department_id
    AND role = 'manager';

  -- Set the new manager and return the result
  INSERT INTO public.user_departments (user_id, department_id, role)
  VALUES (p_user_id, p_department_id, 'manager')
  ON CONFLICT (user_id, department_id)
  DO UPDATE SET role = 'manager'
  RETURNING * INTO result;

  RETURN result;
END;
$$;
```
