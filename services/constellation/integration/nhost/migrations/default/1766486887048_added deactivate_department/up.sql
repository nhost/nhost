CREATE OR REPLACE FUNCTION public.deactivate_department(p_department_id UUID, session json)
RETURNS SETOF public.user_departments
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  IF session->>'x-hasura-role' != 'admin'
     AND NOT (p_department_id = ANY(COALESCE(session->>'x-hasura-department-manager', '{}')::uuid[])) THEN
    RAISE EXCEPTION 'Permission denied: not a manager of department %', p_department_id;
  END IF;

  RETURN QUERY
  UPDATE public.user_departments
  SET is_active = false
  WHERE department_id = p_department_id
  RETURNING *;
END;
$$;
